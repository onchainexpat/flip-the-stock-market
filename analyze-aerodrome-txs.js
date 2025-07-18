const { createPublicClient, http } = require('viem');
const { base } = require('viem/chains');

const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org')
});

async function analyzeTx(txHash) {
  try {
    console.log(`\n🔍 Analyzing transaction: ${txHash}`);
    
    const tx = await client.getTransaction({ hash: txHash });
    console.log('📋 Transaction Details:');
    console.log('   To:', tx.to);
    console.log('   From:', tx.from);
    console.log('   Value:', tx.value.toString());
    console.log('   Gas:', tx.gas.toString());
    console.log('   Gas Price:', tx.gasPrice?.toString());
    console.log('   Data Length:', tx.input.length);
    console.log('   First 10 bytes of data:', tx.input.slice(0, 20));
    
    // Get transaction receipt for logs
    const receipt = await client.getTransactionReceipt({ hash: txHash });
    console.log('📝 Receipt Details:');
    console.log('   Status:', receipt.status);
    console.log('   Gas Used:', receipt.gasUsed.toString());
    console.log('   Contract Address:', receipt.contractAddress);
    console.log('   Logs Count:', receipt.logs.length);
    
    // Analyze logs for swap events
    receipt.logs.forEach((log, index) => {
      console.log(`   Log ${index}:`);
      console.log('     Address:', log.address);
      console.log('     Topics:', log.topics.length);
      console.log('     Data Length:', log.data.length);
    });
    
    return { tx, receipt };
  } catch (error) {
    console.error('❌ Error analyzing transaction:', error.message);
  }
}

async function main() {
  const tx1 = '0x33fd4041490253388e92be7154beabbf238ede0872a7d9ca49c0235df468cf95';
  const tx2 = '0xdcabcd232fa553618a3064ec845f4795c164d1ad1d3f2760dfd7f6df58926c33';
  
  await analyzeTx(tx1);
  await analyzeTx(tx2);
}

main().catch(console.error);