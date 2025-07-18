// Let's reverse engineer the exact function from the transaction
// The selector 0x24856bc3 doesn't match standard swap functions

const { keccak256, toBytes } = require('viem');

// Let's try some other potential function signatures
const functions = [
  'swapExactTokensForTokens(uint256,uint256,(address,address,bool,address)[],address,uint256)',
  'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)',
  'swapExactTokensForETH(uint256,uint256,(address,address,bool,address)[],address,uint256)',
  'swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,uint256,(address,address,bool,address)[],address,uint256)',
  'executeTransaction(bytes,bytes)',
  'multicall(bytes[])',
  'swapExactTokensForTokensSimple(uint256,uint256,address,address,bool,address,uint256)',
];

console.log('Searching for function with selector 0x24856bc3...\n');

functions.forEach(func => {
  const hash = keccak256(toBytes(func));
  const selector = hash.slice(0, 10);
  console.log(`${selector}: ${func}`);
  if (selector === '0x24856bc3') {
    console.log('✅ MATCH FOUND!');
  }
});

// Let's also check what the actual transaction data looks like
console.log('\n🔍 Transaction Analysis:');
console.log('Selector: 0x24856bc3');
console.log('This might be a custom Aerodrome function or multicall');

// The transaction data shows this is likely swapExactTokensForTokensSimple
const testFunc = 'swapExactTokensForTokensSimple(uint256,uint256,address,address,bool,address,uint256)';
const testHash = keccak256(toBytes(testFunc));
console.log(`\nTesting: ${testFunc}`);
console.log(`Selector: ${testHash.slice(0, 10)}`);

// Let's try the exact function that might be used
const likelyFunc = 'execute(bytes)';
const likelyHash = keccak256(toBytes(likelyFunc));
console.log(`\nTesting: ${likelyFunc}`);
console.log(`Selector: ${likelyHash.slice(0, 10)}`);

// Maybe it's a batch transaction function
const batchFunc = 'execute(bytes,bytes)';
const batchHash = keccak256(toBytes(batchFunc));
console.log(`\nTesting: ${batchFunc}`);
console.log(`Selector: ${batchHash.slice(0, 10)}`);

// Maybe it's Router02 style
const router02Func = 'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)';
const router02Hash = keccak256(toBytes(router02Func));
console.log(`\nRouter02 style: ${router02Func}`);
console.log(`Selector: ${router02Hash.slice(0, 10)}`);

console.log('\n📝 Note: 0x24856bc3 might be a proxy or multicall function');