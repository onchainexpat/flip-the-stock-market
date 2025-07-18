const { keccak256, toBytes } = require('viem');

// Check the function selector for swapExactTokensForTokens
const func1 = 'swapExactTokensForTokens(uint256,uint256,(address,address,bool,address)[],address,uint256)';
const func2 = 'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)';

const hash1 = keccak256(toBytes(func1));
const hash2 = keccak256(toBytes(func2));

console.log('Function 1:', func1);
console.log('Selector 1:', hash1.slice(0, 10));
console.log();
console.log('Function 2:', func2);
console.log('Selector 2:', hash2.slice(0, 10));
console.log();
console.log('Expected from transaction: 0x24856bc3');
console.log('Generated in our code: 0xcac88ea9');