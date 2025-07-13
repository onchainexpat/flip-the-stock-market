import { NextResponse } from 'next/server';
import { serverAgentKeyService } from '../../../services/serverAgentKeyService';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';
import {
  createPublicClient,
  http,
  encodeFunctionData,
  erc20Abi,
  parseUnits,
  type Address
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { TOKENS } from '../../../utils/openOceanApi';

export const runtime = 'nodejs';

const ZERODEV_RPC_URL = process.env.NEXT_PUBLIC_ZERODEV_RPC_URL || '';

// Test simple gasless transaction (USDC approval only)
export async function POST(request: Request) {
  try {
    const { orderId, newAgentKeyId } = await request.json();
    
    if (!orderId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Order ID required' 
      }, { status: 400 });
    }

    console.log(`🧪 Testing simple gasless transaction for order: ${orderId}`);
    if (newAgentKeyId) {
      console.log(`   Using new agent key: ${newAgentKeyId}`);
    }

    // Get the order
    const order = await serverDcaDatabase.getOrder(orderId);
    if (!order) {
      return NextResponse.json({ 
        success: false, 
        error: 'Order not found' 
      }, { status: 404 });
    }

    // Parse order data
    const orderData = typeof order.sessionKeyData === 'string' 
      ? JSON.parse(order.sessionKeyData) 
      : order.sessionKeyData;

    const agentKeyId = newAgentKeyId || orderData.agentKeyId;
    if (!agentKeyId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Agent key ID not found' 
      }, { status: 400 });
    }

    console.log(`🔐 Using agent key: ${agentKeyId}`);

    // Get agent key data
    const agentKeyData = await serverAgentKeyService.getAgentKey(agentKeyId);
    if (!agentKeyData || !agentKeyData.sessionKeyApproval) {
      return NextResponse.json({ 
        success: false, 
        error: 'Agent key or session approval not found' 
      }, { status: 404 });
    }

    // Get private key
    const privateKey = await serverAgentKeyService.getPrivateKey(agentKeyId);
    if (!privateKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Agent private key not found' 
      }, { status: 404 });
    }

    const smartWalletAddress = order.sessionKeyAddress as Address;
    console.log(`🏦 Smart wallet: ${smartWalletAddress}`);

    // Create public client
    const publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC_URL)
    });

    // Check balances before transaction
    const ethBalance = await publicClient.getBalance({ address: smartWalletAddress });
    const usdcBalance = await publicClient.readContract({
      address: TOKENS.USDC,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [smartWalletAddress],
    });

    console.log(`💰 Pre-transaction balances:`);
    console.log(`   ETH: ${(Number(ethBalance) / 1e18).toFixed(6)} ETH`);
    console.log(`   USDC: ${(Number(usdcBalance) / 1e6).toFixed(6)} USDC`);

    // Create agent account
    const agentAccount = privateKeyToAccount(privateKey);
    console.log('🤖 Agent address:', agentAccount.address);

    // Import ZeroDev modules
    console.log('📦 Importing ZeroDev modules...');
    const { toECDSASigner } = await import('@zerodev/permissions/signers');
    const { deserializePermissionAccount } = await import('@zerodev/permissions');
    const { KERNEL_V3_1, getEntryPoint } = await import('@zerodev/sdk/constants');
    const { createKernelAccountClient, createZeroDevPaymasterClient } = await import('@zerodev/sdk');

    // Create agent signer
    const agentSigner = await toECDSASigner({ signer: agentAccount });

    // Deserialize permission account
    console.log('🔓 Deserializing permission account...');
    const smartWallet = await deserializePermissionAccount(
      publicClient,
      getEntryPoint('0.7'),
      KERNEL_V3_1,
      agentKeyData.sessionKeyApproval,
      agentSigner
    );

    console.log('✅ Permission account deserialized');
    console.log(`   Address: ${smartWallet.address}`);
    console.log(`   Match: ${smartWallet.address.toLowerCase() === smartWalletAddress.toLowerCase()}`);

    // Create paymaster
    console.log('💰 Creating ZeroDev paymaster...');
    const paymaster = createZeroDevPaymasterClient({
      chain: base,
      transport: http(ZERODEV_RPC_URL),
    });

    // Create kernel client with simple configuration
    console.log('🔧 Creating kernel account client...');
    const kernelClient = createKernelAccountClient({
      account: smartWallet,
      chain: base,
      bundlerTransport: http(ZERODEV_RPC_URL),
      middleware: {
        sponsorUserOperation: paymaster.sponsorUserOperation,
      },
    });

    console.log('✅ Kernel client created');

    // Prepare a simple USDC approval transaction
    const approvalAmount = parseUnits('1', 6); // Approve 1 USDC
    const spender = '0x6352a56caadc4f1e25cd6c75970fa768a3304e64' as Address; // OpenOcean router

    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, approvalAmount],
    });

    console.log('📝 Sending gasless USDC approval transaction...');
    console.log(`   Amount: ${(Number(approvalAmount) / 1e6).toFixed(6)} USDC`);
    console.log(`   Spender: ${spender}`);

    try {
      const txHash = await kernelClient.sendTransaction({
        to: TOKENS.USDC,
        value: 0n,
        data: approveData,
      });

      console.log('✅ Transaction sent successfully!');
      console.log(`   Hash: ${txHash}`);

      // Wait for transaction and check final balances
      await new Promise(resolve => setTimeout(resolve, 10000));

      const finalEthBalance = await publicClient.getBalance({ address: smartWalletAddress });
      const finalUsdcBalance = await publicClient.readContract({
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [smartWalletAddress],
      });

      console.log(`💰 Post-transaction balances:`);
      console.log(`   ETH: ${(Number(finalEthBalance) / 1e18).toFixed(6)} ETH`);
      console.log(`   USDC: ${(Number(finalUsdcBalance) / 1e6).toFixed(6)} USDC`);

      const ethUsed = ethBalance - finalEthBalance;
      console.log(`⛽ ETH used for gas: ${(Number(ethUsed) / 1e18).toFixed(6)} ETH`);

      if (ethUsed === 0n) {
        console.log('🎉 PERFECT! No ETH was used - fully gasless execution!');
      }

      return NextResponse.json({
        success: true,
        message: 'Simple gasless transaction executed successfully',
        txHash,
        gasless: ethUsed === 0n,
        balances: {
          pre: {
            eth: (Number(ethBalance) / 1e18).toFixed(6),
            usdc: (Number(usdcBalance) / 1e6).toFixed(6)
          },
          post: {
            eth: (Number(finalEthBalance) / 1e18).toFixed(6),
            usdc: (Number(finalUsdcBalance) / 1e6).toFixed(6)
          }
        },
        ethUsed: (Number(ethUsed) / 1e18).toFixed(6)
      });

    } catch (txError) {
      console.error('❌ Transaction failed:', txError);
      
      const errorMessage = txError instanceof Error ? txError.message : 'Unknown error';
      
      return NextResponse.json({
        success: false,
        error: `Transaction failed: ${errorMessage}`,
        balances: {
          pre: {
            eth: (Number(ethBalance) / 1e18).toFixed(6),
            usdc: (Number(usdcBalance) / 1e6).toFixed(6)
          }
        }
      });
    }

  } catch (error) {
    console.error('❌ Simple gasless test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}