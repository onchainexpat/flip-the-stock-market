// Quick script to check smart wallet balance directly
const { createPublicClient, http, parseAbi } = require('viem');
const { base } = require('viem/chains');

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const SPX_ADDRESS = '0x50da645f148798F68EF2d7dB7C1CB22A6819bb2C';

// Your smart wallet address (from the UI)
const SMART_WALLET = '0x320b2943e26ccbDacE18575e7974EDC200BA4dCE';

const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

async function checkBalance() {
  console.log('🔍 Checking smart wallet balance...');
  console.log('   Smart Wallet:', SMART_WALLET);
  
  try {
    // Check USDC balance
    const usdcBalance = await client.readContract({
      address: USDC_ADDRESS,
      abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
      functionName: 'balanceOf',
      args: [SMART_WALLET],
    });
    
    console.log('💰 USDC Balance:', Number(usdcBalance) / 1e6, 'USDC');
    
    // Check SPX balance
    const spxBalance = await client.readContract({
      address: SPX_ADDRESS,
      abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
      functionName: 'balanceOf',
      args: [SMART_WALLET],
    });
    
    console.log('🪙 SPX Balance:', Number(spxBalance) / 1e8, 'SPX');
    
    // Check ETH balance
    const ethBalance = await client.getBalance({ address: SMART_WALLET });
    console.log('⚡ ETH Balance:', Number(ethBalance) / 1e18, 'ETH');
    
  } catch (error) {
    console.error('❌ Error checking balance:', error);
  }
}

checkBalance();