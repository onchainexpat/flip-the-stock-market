import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const txHash = '0x14a66ce8f07a43787d5185ef8db91585e5a0b87815b211a694f80ea515872a97';

async function debugTransaction() {
  try {
    console.log('🔍 Debugging transaction:', txHash);
    
    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });

    // Get transaction details
    const tx = await publicClient.getTransaction({ hash: txHash });
    console.log('\n📋 Transaction Details:');
    console.log('   From:', tx.from);
    console.log('   To:', tx.to);
    console.log('   Value:', tx.value.toString());
    console.log('   Gas:', tx.gas.toString());
    console.log('   Gas Price:', tx.gasPrice?.toString() || 'N/A');
    console.log('   Data length:', tx.input.length);
    console.log('   Data preview:', tx.input.slice(0, 42) + '...');

    // Get transaction receipt
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    console.log('\n📃 Transaction Receipt:');
    console.log('   Status:', receipt.status === 'success' ? '✅ SUCCESS' : '❌ FAILED');
    console.log('   Gas Used:', receipt.gasUsed.toString());
    console.log('   Block Number:', receipt.blockNumber.toString());
    console.log('   Logs count:', receipt.logs.length);
    
    if (receipt.logs.length > 0) {
      console.log('\n📝 Event Logs:');
      receipt.logs.forEach((log, index) => {
        console.log(`   Log ${index + 1}:`);
        console.log(`     Address: ${log.address}`);
        console.log(`     Topics: ${log.topics.length} topics`);
        console.log(`     Data: ${log.data.slice(0, 42)}...`);
      });
    }

    // Check if this looks like an approval transaction
    const approveSelector = '0x095ea7b3'; // approve(address,uint256)
    if (tx.input.startsWith(approveSelector)) {
      console.log('\n✅ This is an approve() transaction');
      console.log('   Target contract:', tx.to);
      
      // Parse approval data (simplified)
      const spender = '0x' + tx.input.slice(34, 74);
      const amount = '0x' + tx.input.slice(74);
      console.log('   Spender:', spender);
      console.log('   Amount:', BigInt(amount).toString());
    } else {
      console.log('\n⚠️ This does not appear to be a standard approve() transaction');
      console.log('   Function selector:', tx.input.slice(0, 10));
    }

  } catch (error) {
    console.error('❌ Error debugging transaction:', error);
  }
}

debugTransaction();