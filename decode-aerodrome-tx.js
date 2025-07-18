const {
  createPublicClient,
  http,
  decodeAbiParameters,
  parseAbiParameters,
} = require('viem');
const { base } = require('viem/chains');

const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

// Common Aerodrome Router ABI functions
const AERODROME_ROUTER_ABI = [
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      {
        name: 'routes',
        type: 'tuple[]',
        components: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'stable', type: 'bool' },
          { name: 'factory', type: 'address' },
        ],
      },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    type: 'function',
  },
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      {
        name: 'routes',
        type: 'tuple[]',
        components: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'stable', type: 'bool' },
          { name: 'factory', type: 'address' },
        ],
      },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
    outputs: [],
    type: 'function',
  },
];

async function decodeTx() {
  const txHash =
    '0x33fd4041490253388e92be7154beabbf238ede0872a7d9ca49c0235df468cf95';

  try {
    const tx = await client.getTransaction({ hash: txHash });
    console.log('🔍 Aerodrome Router:', tx.to);
    console.log('📝 Transaction Input Data:');
    console.log('   Full Data:', tx.input);
    console.log('   Function Selector:', tx.input.slice(0, 10));

    // Try to decode with common router functions
    const functionSelector = tx.input.slice(0, 10);

    if (functionSelector === '0x24856bc3') {
      console.log('✅ Function: swapExactTokensForTokens');

      // Decode parameters manually
      const params = tx.input.slice(10);
      console.log('   Params data length:', params.length);

      // Let's extract key addresses and amounts from the data
      console.log('\n🔧 Extracting key info from transaction data...');

      // Look for USDC address in the data
      const usdcAddress = '833589fcd6edb6e08f4c7c32d4f71b54bda02913';
      const spxAddress = '50da645f148798f68ef2d7db7c1cb22a6819bb2c';

      const usdcIndex = tx.input
        .toLowerCase()
        .indexOf(usdcAddress.toLowerCase());
      const spxIndex = tx.input.toLowerCase().indexOf(spxAddress.toLowerCase());

      console.log('   USDC found at position:', usdcIndex);
      console.log('   SPX found at position:', spxIndex);

      // The transaction logs will show us the actual swap amounts
      const receipt = await client.getTransactionReceipt({ hash: txHash });

      // Look for Transfer events in logs
      console.log('\n📊 Transfer Events:');
      receipt.logs.forEach((log, index) => {
        if (
          log.topics[0] ===
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
        ) {
          // This is a Transfer event
          const from = '0x' + log.topics[1].slice(26);
          const to = '0x' + log.topics[2].slice(26);
          const amount = BigInt(log.data);

          console.log(`   Log ${index} - Transfer:`);
          console.log(`     Token: ${log.address}`);
          console.log(`     From: ${from}`);
          console.log(`     To: ${to}`);
          console.log(`     Amount: ${amount.toString()}`);

          if (
            log.address.toLowerCase() ===
            '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
          ) {
            console.log(
              `     ^ USDC Transfer: ${(Number(amount) / 1e6).toFixed(6)} USDC`,
            );
          }
          if (
            log.address.toLowerCase() ===
            '0x50da645f148798f68ef2d7db7c1cb22a6819bb2c'
          ) {
            console.log(
              `     ^ SPX6900 Transfer: ${(Number(amount) / 1e8).toFixed(8)} SPX`,
            );
          }
        }
      });
    } else {
      console.log('❓ Unknown function selector:', functionSelector);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

decodeTx();
