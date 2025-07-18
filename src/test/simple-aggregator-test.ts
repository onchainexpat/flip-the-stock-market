/**
 * Simple test to validate multi-aggregator error handling
 */

import { multiAggregatorService } from '../services/multiAggregatorService';
import { TOKENS } from '../utils/openOceanApi';

async function testCircuitBreaker() {
  console.log('🔌 Testing Circuit Breaker Functionality...\n');

  try {
    // Test with valid parameters to see which aggregators respond
    console.log('📊 Testing with 10 USDC...');

    const result = await multiAggregatorService.getBestSwapQuote(
      TOKENS.USDC,
      TOKENS.SPX6900,
      '10000000', // 10 USDC
      '0x742E4e12936393F21CAcEE8087Db76bF304E4534', // Real address
    );

    console.log(`✅ Success! Best aggregator: ${result.bestQuote.aggregator}`);
    console.log(`   Output: ${result.bestQuote.buyAmount} tokens`);
    console.log(`   Quotes received: ${result.metadata.quotesReceived}/3`);
    console.log(
      `   Average response time: ${result.metadata.averageResponseTime}ms`,
    );

    if (result.allQuotes.length > 1) {
      console.log(
        `   Savings: ${result.savingsVsWorst.amount} tokens (${result.savingsVsWorst.percentage}%)`,
      );
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  // Show circuit breaker status
  console.log('\n🔌 Circuit Breaker Status:');
  const status = multiAggregatorService.getCircuitBreakerStatus();

  Object.entries(status).forEach(([aggregator, state]) => {
    const statusIcon = state.isOpen ? '🔴' : '🟢';
    console.log(
      `   ${statusIcon} ${aggregator}: ${state.failures} failures, ${state.isOpen ? 'OPEN' : 'CLOSED'}`,
    );
  });
}

async function testFallback() {
  console.log('\n🆘 Testing Fallback Mechanism...\n');

  try {
    // Force a fallback scenario with a very small amount
    console.log(
      '📊 Testing with 0.0001 USDC (likely to fail most aggregators)...',
    );

    const result = await multiAggregatorService.getBestSwapQuote(
      TOKENS.USDC,
      TOKENS.SPX6900,
      '100', // 0.0001 USDC
      '0x742E4e12936393F21CAcEE8087Db76bF304E4534',
    );

    console.log(`✅ Fallback worked! Using: ${result.bestQuote.aggregator}`);
    console.log(`   Output: ${result.bestQuote.buyAmount} tokens`);
  } catch (error) {
    console.log(`❌ Expected failure: ${error.message}`);
  }
}

// Run tests
async function main() {
  await testCircuitBreaker();
  await testFallback();
  console.log('\n✅ Error handling tests completed!');
}

main().catch(console.error);
