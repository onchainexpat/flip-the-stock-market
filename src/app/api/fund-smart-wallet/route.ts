import { NextResponse } from 'next/server';
import { createPublicClient, http, parseEther, createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

export const runtime = 'nodejs';

// Fund a smart wallet with minimal ETH for gas simulation (testing only)
export async function POST(request: Request) {
  try {
    const { smartWalletAddress } = await request.json();
    
    if (!smartWalletAddress) {
      return NextResponse.json({ 
        success: false, 
        error: 'Smart wallet address required' 
      }, { status: 400 });
    }

    console.log(`⛽ Funding smart wallet with ETH: ${smartWalletAddress}`);

    // Use deployer account to fund the smart wallet
    const deployerPrivateKey = process.env.GELATO_DEPLOYER_PRIVATE_KEY;
    if (!deployerPrivateKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Deployer private key not configured' 
      }, { status: 500 });
    }

    // Create deployer account
    const deployerAccount = privateKeyToAccount(deployerPrivateKey as `0x${string}`);
    
    // Create wallet client
    const walletClient = createWalletClient({
      account: deployerAccount,
      chain: base,
      transport: http(process.env.NEXT_PUBLIC_ZERODEV_RPC_URL)
    });

    // Send 0.002 ETH to smart wallet
    const amount = parseEther('0.002');
    console.log('📞 Sending 0.002 ETH to smart wallet...');
    
    const txHash = await walletClient.sendTransaction({
      to: smartWalletAddress as `0x${string}`,
      value: amount
    });

    console.log('✅ Smart wallet funded successfully');
    console.log('   Amount: 0.002 ETH');
    console.log('   Tx hash:', txHash);

    return NextResponse.json({
      success: true,
      message: 'Smart wallet funded with ETH for gas simulation',
      smartWalletAddress,
      amount: '0.002 ETH',
      txHash
    });

  } catch (error) {
    console.error('❌ Failed to fund smart wallet:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}