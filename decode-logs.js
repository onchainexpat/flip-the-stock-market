import { createPublicClient, http, decodeEventLog } from 'viem';
import { base } from 'viem/chains';
import { erc20Abi } from 'viem';

const txHash = '0x14a66ce8f07a43787d5185ef8db91585e5a0b87815b211a694f80ea515872a97';
const userWallet = '0x22F7D3e8E085b6d8B7d3fE11E06B9391eE858779';
const usdcAddress = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

async function decodeLogs() {
  try {
    console.log('🔍 Decoding transaction logs:', txHash);
    
    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });

    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    
    console.log('\n📝 Analyzing logs...');
    
    receipt.logs.forEach((log, index) => {
      console.log(`\n--- Log ${index + 1} ---`);
      console.log('Contract:', log.address);
      
      if (log.address.toLowerCase() === usdcAddress.toLowerCase()) {
        console.log('📍 This is a USDC contract log');
        
        try {
          // Try to decode as Approval event
          const decoded = decodeEventLog({
            abi: erc20Abi,
            data: log.data,
            topics: log.topics,
          });
          
          console.log('✅ Decoded event:', decoded.eventName);
          console.log('   Args:', decoded.args);
          
          if (decoded.eventName === 'Approval') {
            const { owner, spender, value } = decoded.args;
            console.log(`   Owner: ${owner}`);
            console.log(`   Spender: ${spender}`);
            console.log(`   Amount: ${value.toString()}`);
            
            if (owner.toLowerCase() === userWallet.toLowerCase()) {
              console.log('✅ This approval is FROM your wallet!');
            } else {
              console.log('⚠️ This approval is NOT from your wallet');
              console.log(`   Expected: ${userWallet}`);
              console.log(`   Actual: ${owner}`);
            }
          }
          
        } catch (error) {
          console.log('❌ Failed to decode as ERC20 event:', error.message);
          console.log('   Raw topics:', log.topics);
          console.log('   Raw data:', log.data);
        }
      } else {
        console.log('📍 Non-USDC contract log');
        console.log('   Topics:', log.topics.length);
        console.log('   Data length:', log.data.length);
      }
    });

    // Check current allowance again to be sure
    console.log('\n🔍 Re-checking current allowance...');
    const currentAllowance = await publicClient.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [userWallet, '0x6352a56caadC4F1E25CD6c75970Fa768A3304e64'],
    });
    
    console.log('Current allowance:', currentAllowance.toString());

  } catch (error) {
    console.error('❌ Error decoding logs:', error);
  }
}

decodeLogs();