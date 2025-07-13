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

// Test gasless execution with existing session key by using improved paymaster
export async function POST(request: Request) {
  try {
    const { orderId, testAmount = '0.5' } = await request.json();
    
    if (!orderId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Order ID required' 
      }, { status: 400 });
    }

    console.log(`🧪 Testing gasless with existing session key for order: ${orderId}`);

    // Get the order
    const order = await serverDcaDatabase.getOrder(orderId);
    if (!order) {
      return NextResponse.json({ 
        success: false, 
        error: 'Order not found' 
      }, { status: 404 });
    }

    // Parse order data to get ORIGINAL agent key
    const orderData = typeof order.sessionKeyData === 'string' 
      ? JSON.parse(order.sessionKeyData) 
      : order.sessionKeyData;

    // Use the ORIGINAL agent key (before we switched it)
    const originalAgentKeyId = 'session_1752425582773_jlrmq3t'; // The original one that matches this smart wallet
    console.log(`🔐 Using original agent key: ${originalAgentKeyId}`);

    // Get agent key data
    const agentKeyData = await serverAgentKeyService.getAgentKey(originalAgentKeyId);
    if (!agentKeyData || !agentKeyData.sessionKeyApproval) {
      return NextResponse.json({ 
        success: false, 
        error: 'Original agent key or session approval not found' 
      }, { status: 404 });
    }

    // Get private key
    const privateKey = await serverAgentKeyService.getPrivateKey(originalAgentKeyId);
    if (!privateKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Agent private key not found' 
      }, { status: 404 });
    }

    const smartWalletAddress = order.sessionKeyAddress as Address;
    const swapAmount = parseUnits(testAmount, 6);

    console.log(`🏦 Smart wallet: ${smartWalletAddress}`);
    console.log(`🔄 Swap amount: ${testAmount} USDC`);

    // Create public client
    const publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC_URL)
    });

    // Check balances
    const ethBalance = await publicClient.getBalance({ address: smartWalletAddress });
    const usdcBalance = await publicClient.readContract({
      address: TOKENS.USDC,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [smartWalletAddress],
    });

    console.log(`💰 Balances:`);
    console.log(`   ETH: ${(Number(ethBalance) / 1e18).toFixed(6)} ETH`);
    console.log(`   USDC: ${(Number(usdcBalance) / 1e6).toFixed(6)} USDC`);

    if (usdcBalance < swapAmount) {
      return NextResponse.json({
        success: false,
        error: `Insufficient USDC: ${(Number(usdcBalance) / 1e6).toFixed(6)} < ${testAmount}`,
        balances: {
          eth: (Number(ethBalance) / 1e18).toFixed(6),
          usdc: (Number(usdcBalance) / 1e6).toFixed(6)
        }
      });
    }

    // Create agent account
    const agentAccount = privateKeyToAccount(privateKey);
    console.log('🤖 Agent address:', agentAccount.address);

    // Import ZeroDev modules
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

    if (smartWallet.address.toLowerCase() !== smartWalletAddress.toLowerCase()) {
      return NextResponse.json({
        success: false,
        error: 'Smart wallet address mismatch with original session key',
        details: {
          deserializedAddress: smartWallet.address,
          expectedAddress: smartWalletAddress
        }
      });
    }

    // Create enhanced paymaster configuration
    console.log('💰 Setting up enhanced paymaster...');
    const paymaster = createZeroDevPaymasterClient({
      chain: base,
      transport: http(ZERODEV_RPC_URL),
    });

    // Create kernel client with enhanced sponsorship
    const kernelClient = createKernelAccountClient({
      account: smartWallet,
      chain: base,
      bundlerTransport: http(ZERODEV_RPC_URL),
      middleware: {
        sponsorUserOperation: async (args) => {
          console.log('💰 Sponsoring user operation...');
          try {
            const sponsored = await paymaster.sponsorUserOperation(args);
            console.log('✅ User operation sponsored');
            return sponsored;
          } catch (sponsorError) {
            console.error('❌ Sponsorship failed:', sponsorError);
            throw sponsorError;
          }
        },
        gasPrice: async () => {
          const gasPrice = await publicClient.getGasPrice();
          const adjustedPrice = (gasPrice * 120n) / 100n; // 20% buffer
          return {
            maxFeePerGas: adjustedPrice,
            maxPriorityFeePerGas: adjustedPrice / 20n,
          };
        },
      },
    });

    console.log('✅ Enhanced kernel client created');

    // Get swap quote
    console.log('💱 Getting swap quote...');
    const requestBody = {
      sellToken: TOKENS.USDC,
      buyToken: TOKENS.SPX6900,
      sellAmount: swapAmount.toString(),
      takerAddress: smartWallet.address,
      receiverAddress: smartWallet.address,
      slippagePercentage: 0.05,
      gasPrice: 'standard',
      complexityLevel: 0,
      disableEstimate: false,
      allowPartialFill: false,
      preferDirect: true,
      maxHops: 2,
    };

    const swapResponse = await fetch('http://localhost:3000/api/openocean-swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!swapResponse.ok) {
      const swapError = await swapResponse.json();
      return NextResponse.json({
        success: false,
        error: `Swap quote failed: ${swapError.error}`,
      });
    }

    const swapData = await swapResponse.json();
    console.log('✅ Swap quote received');
    console.log(`   Expected SPX: ${swapData.outAmount || swapData.buyAmount}`);

    try {
      // Step 1: Approve USDC
      console.log('📝 Step 1: Approving USDC...');
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [swapData.allowanceTarget || '0x6352a56caadc4f1e25cd6c75970fa768a3304e64', swapAmount],
      });

      const approveTxHash = await kernelClient.sendTransaction({
        to: TOKENS.USDC,
        value: 0n,
        data: approveData,
      });

      console.log('✅ Approval tx (gasless):', approveTxHash);

      // Wait for approval
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Step 2: Execute swap
      console.log('📝 Step 2: Executing swap...');
      const swapTxHash = await kernelClient.sendTransaction({
        to: swapData.to,
        value: BigInt(swapData.value || '0'),
        data: swapData.data,
      });

      console.log('✅ Swap tx (gasless):', swapTxHash);

      // Check final balances
      await new Promise(resolve => setTimeout(resolve, 15000));

      const finalEthBalance = await publicClient.getBalance({ address: smartWalletAddress });
      const finalUsdcBalance = await publicClient.readContract({
        address: TOKENS.USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [smartWalletAddress],
      });
      const spxBalance = await publicClient.readContract({
        address: TOKENS.SPX6900,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [smartWalletAddress],
      });

      const ethUsed = ethBalance - finalEthBalance;

      console.log(`💰 Final balances:`);
      console.log(`   ETH: ${(Number(finalEthBalance) / 1e18).toFixed(6)} ETH`);
      console.log(`   USDC: ${(Number(finalUsdcBalance) / 1e6).toFixed(6)} USDC`);
      console.log(`   SPX: ${(Number(spxBalance) / 1e8).toFixed(8)} SPX`);
      console.log(`   ETH used: ${(Number(ethUsed) / 1e18).toFixed(6)} ETH`);

      if (ethUsed === 0n) {
        console.log('🎉 PERFECT! Fully gasless execution completed!');
      }

      return NextResponse.json({
        success: true,
        message: 'Gasless DCA execution completed successfully',
        gasless: ethUsed === 0n,
        transactions: {
          approve: approveTxHash,
          swap: swapTxHash
        },
        balances: {
          pre: {
            eth: (Number(ethBalance) / 1e18).toFixed(6),
            usdc: (Number(usdcBalance) / 1e6).toFixed(6)
          },
          post: {
            eth: (Number(finalEthBalance) / 1e18).toFixed(6),
            usdc: (Number(finalUsdcBalance) / 1e6).toFixed(6),
            spx: (Number(spxBalance) / 1e8).toFixed(8)
          }
        },
        ethUsed: (Number(ethUsed) / 1e18).toFixed(6),
        swapAmount: testAmount,
        spxReceived: (Number(spxBalance) / 1e8).toFixed(8)
      });

    } catch (txError) {
      console.error('❌ Transaction failed:', txError);
      return NextResponse.json({
        success: false,
        error: `Transaction failed: ${txError instanceof Error ? txError.message : 'Unknown error'}`,
      });
    }

  } catch (error) {
    console.error('❌ Gasless test with existing key failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}