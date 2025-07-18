import { http, createPublicClient } from 'viem';
import { erc20Abi } from 'viem';
import { base } from 'viem/chains';

const userAddress = '0x22F7D3e8E085b6d8B7d3fE11E06B9391eE858779';
const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const openOceanRouter = '0x6352a56caadC4F1E25CD6c75970Fa768A3304e64';

async function checkAllowanceAndBalance() {
  try {
    console.log('🔍 Checking USDC allowance and balance...');
    console.log('   User:', userAddress);
    console.log('   Router:', openOceanRouter);

    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });

    // Check USDC balance
    const balance = await publicClient.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [userAddress],
    });

    // Check USDC allowance
    const allowance = await publicClient.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [userAddress, openOceanRouter],
    });

    console.log('\n💰 Results:');
    console.log('   USDC Balance:', (Number(balance) / 1e6).toFixed(6), 'USDC');
    console.log('   USDC Allowance:', allowance.toString());

    if (allowance > 0n) {
      console.log('✅ Approval successful! User can now swap USDC.');
    } else {
      console.log('❌ No allowance found. Approval may have failed.');
    }
  } catch (error) {
    console.error('❌ Error checking allowance:', error);
  }
}

checkAllowanceAndBalance();
