// Fund the working smart wallet with USDC from the existing wallet
import { http, createPublicClient, erc20Abi } from 'viem';
import { base } from 'viem/chains';

const BASE_URL = 'http://localhost:3000';

// Wallet addresses
const EXISTING_WALLET = '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE';
const WORKING_WALLET = '0x8127778edEbe2FdDCb4a20AC0F52789A7bFf7F65';

// Token addresses
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

async function fundWorkingWallet() {
  console.log('💰 Funding working wallet with USDC...');
  console.log('   From:', EXISTING_WALLET);
  console.log('   To:', WORKING_WALLET);

  try {
    // Use our mainnet configuration
    const ZERODEV_RPC =
      process.env.NEXT_PUBLIC_ZERODEV_RPC_URL ||
      'https://rpc.zerodev.app/api/v3/4dcfe8c1-3f73-4977-b000-a736e7514079/chain/8453';

    const publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC),
    });

    // Check existing wallet balance
    const existingBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [EXISTING_WALLET],
    });

    console.log('📊 Current balances:');
    console.log(
      '   Existing wallet:',
      (Number(existingBalance) / 1e6).toFixed(6),
      'USDC',
    );

    // Check working wallet balance
    const workingBalance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [WORKING_WALLET],
    });

    console.log(
      '   Working wallet:',
      (Number(workingBalance) / 1e6).toFixed(6),
      'USDC',
    );

    if (existingBalance < 1000000n) {
      console.log('❌ Existing wallet has insufficient USDC balance');
      return;
    }

    if (workingBalance >= 1000000n) {
      console.log('✅ Working wallet already has sufficient USDC balance');
      return;
    }

    // Transfer USDC from existing wallet to working wallet
    console.log(
      '🔄 Transferring 1 USDC from existing wallet to working wallet...',
    );
    console.log(
      '   This requires using the session key of the existing wallet',
    );

    // Get the latest existing order to use its session key
    const ordersResponse = await fetch(
      `${BASE_URL}/api/unified-dca-orders?userAddress=0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7&limit=1`,
    );
    const ordersResult = await ordersResponse.json();

    if (!ordersResult.success || ordersResult.orders.length === 0) {
      console.log('❌ No existing orders found to get session key');
      return;
    }

    const latestOrder = ordersResult.orders[0];
    console.log('📝 Using existing order for transfer:', latestOrder.id);

    // Create a transfer transaction using the existing order's session key
    const transferResponse = await fetch(`${BASE_URL}/api/test-contract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: latestOrder.id,
        action: 'transfer',
        tokenAddress: USDC_ADDRESS,
        toAddress: WORKING_WALLET,
        amount: '1000000', // 1 USDC
      }),
    });

    const transferResult = await transferResponse.json();

    if (transferResult.success) {
      console.log('✅ USDC transfer successful!');
      console.log('   Transaction hash:', transferResult.txHash);

      // Wait a bit for transaction to be mined
      console.log('⏳ Waiting for transaction to be mined...');
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Check new balances
      const newWorkingBalance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [WORKING_WALLET],
      });

      console.log(
        '📊 New working wallet balance:',
        (Number(newWorkingBalance) / 1e6).toFixed(6),
        'USDC',
      );

      if (newWorkingBalance >= 1000000n) {
        console.log('🎉 Working wallet now has sufficient USDC!');
        console.log('   You can now run the complete DCA test:');
        console.log('   node test-complete-dca-flow.js');
      }
    } else {
      console.log('❌ USDC transfer failed:', transferResult.error);
    }
  } catch (error) {
    console.error('❌ Funding failed:', error.message);
  }
}

fundWorkingWallet();
