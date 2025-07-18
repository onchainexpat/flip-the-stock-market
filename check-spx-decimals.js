// Let's calculate the price properly and check SPX6900 decimals

// Our Aerodrome response:
const sellAmount = 1000000; // 1 USDC (6 decimals)
const buyAmount = 60000000; // SPX6900 amount (unknown decimals)

console.log('📊 Aerodrome Rate Analysis:');
console.log(`Sell: ${sellAmount} (1 USDC)`);
console.log(`Buy: ${buyAmount} (SPX6900 raw)`);

// Let's try different decimal assumptions
const decimalOptions = [6, 8, 18];

decimalOptions.forEach(decimals => {
  const spxReceived = buyAmount / (10 ** decimals);
  const pricePerSPX = 1 / spxReceived; // USD per SPX
  
  console.log(`\nAssuming ${decimals} decimals:`);
  console.log(`  SPX received: ${spxReceived.toFixed(8)}`);
  console.log(`  Price per SPX: $${pricePerSPX.toFixed(6)}`);
  
  // Compare with known rates
  if (pricePerSPX > 1.75 && pricePerSPX < 1.85) {
    console.log(`  ✅ This matches Aerodrome UI (~$1.80)!`);
  }
  if (pricePerSPX > 1.55 && pricePerSPX < 1.65) {
    console.log(`  📊 This matches CoinGecko (~$1.59)`);
  }
});

// Let's also reverse engineer from the known Aerodrome price
console.log('\n🔍 Reverse Engineering:');
console.log('If 1 SPX = 1.78561 USDC (from Aerodrome UI):');
const expectedSPXReceived = 1 / 1.78561; // SPX per USD
console.log(`Expected SPX per 1 USDC: ${expectedSPXReceived.toFixed(8)}`);

// What decimal places would give us this?
decimalOptions.forEach(decimals => {
  const calculatedSPX = buyAmount / (10 ** decimals);
  const diff = Math.abs(calculatedSPX - expectedSPXReceived);
  console.log(`${decimals} decimals gives: ${calculatedSPX.toFixed(8)}, diff: ${diff.toFixed(8)}`);
  
  if (diff < 0.01) {
    console.log(`  ✅ MATCH! SPX6900 uses ${decimals} decimals`);
  }
});

// Based on your transaction analysis earlier:
console.log('\n📈 From your actual transaction:');
console.log('0.1 USDC → 0.06013026 SPX');
const actualRate = 0.06013026 / 0.1;
const actualPrice = 1 / actualRate;
console.log(`Rate: ${actualRate.toFixed(8)} SPX per USDC`);
console.log(`Price: $${actualPrice.toFixed(6)} per SPX`);