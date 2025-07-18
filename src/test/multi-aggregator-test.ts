/**
 * Test script for multi-aggregator integration
 * Tests quote comparison and error handling mechanisms
 */

import { aggregatorExecutionService } from '../services/aggregatorExecutionService';
import { multiAggregatorService } from '../services/multiAggregatorService';
import { TOKENS } from '../utils/openOceanApi';

async function testMultiAggregatorQuotes() {
  console.log('🔍 Testing Multi-Aggregator Quote Comparison...\n');

  try {
    // Test 1: Basic quote comparison
    console.log('📊 Test 1: Basic Quote Comparison');
    console.log('='.repeat(50));

    const result = await multiAggregatorService.getBestSwapQuote(
      TOKENS.USDC,
      TOKENS.SPX6900,
      '5000000', // 5 USDC
      '0x1111111111111111111111111111111111111111',
    );

    console.log(`Best aggregator: ${result.bestQuote.aggregator}`);
    console.log(`Best output: ${result.bestQuote.buyAmount} tokens`);
    console.log(`Price: ${result.bestQuote.price}`);
    console.log(`Quotes received: ${result.metadata.quotesReceived}`);
    console.log(
      `Average response time: ${result.metadata.averageResponseTime}ms`,
    );
    console.log(
      `Savings: ${result.savingsVsWorst.amount} tokens (${result.savingsVsWorst.percentage}%)\n`,
    );

    // Display all quotes
    console.log('All Quotes:');
    result.allQuotes.forEach((quote) => {
      const formatted = multiAggregatorService.formatQuoteForDisplay(quote);
      console.log(`  ${formatted}`);
    });
  } catch (error) {
    console.error('❌ Quote comparison test failed:', error);
  }
}

async function testExecutableSwapData() {
  console.log('\n🔨 Testing Executable Swap Data...\n');

  try {
    // Test 2: Executable swap data
    console.log('📊 Test 2: Executable Swap Data');
    console.log('='.repeat(50));

    const result = await aggregatorExecutionService.getBestExecutableSwap(
      TOKENS.USDC,
      TOKENS.SPX6900,
      '10000000', // 10 USDC
      '0x1111111111111111111111111111111111111111',
    );

    console.log(`Best aggregator: ${result.bestSwap.aggregator}`);
    console.log(`Output amount: ${result.bestSwap.buyAmount} tokens`);
    console.log(`Target address: ${result.bestSwap.to}`);
    console.log(
      `Transaction data length: ${result.bestSwap.data.length} chars`,
    );
    console.log(`Gas estimate: ${result.bestSwap.gas}`);
    console.log(`Price impact: ${result.bestSwap.priceImpact}%`);
    console.log(
      `Successful quotes: ${result.executionMetadata.successfulQuotes}/${result.executionMetadata.totalAggregators}`,
    );
    console.log(
      `Savings: ${result.savings.amount} tokens (${result.savings.percentage}%)\n`,
    );

    // Validate the swap data
    const validation = aggregatorExecutionService.validateSwapData(
      result.bestSwap,
    );
    console.log(`Validation: ${validation.valid ? '✅ Valid' : '❌ Invalid'}`);
    if (!validation.valid) {
      console.log(`Validation error: ${validation.error}`);
    }
  } catch (error) {
    console.error('❌ Executable swap test failed:', error);
  }
}

async function testErrorHandling() {
  console.log('\n🛡️ Testing Error Handling...\n');

  try {
    // Test 3: Error handling with invalid parameters
    console.log('📊 Test 3: Error Handling');
    console.log('='.repeat(50));

    // Test with very small amount (might fail some aggregators)
    const result = await multiAggregatorService.getBestSwapQuote(
      TOKENS.USDC,
      TOKENS.SPX6900,
      '1000', // 0.001 USDC (very small)
      '0x1111111111111111111111111111111111111111',
    );

    console.log(
      `Quotes received with small amount: ${result.metadata.quotesReceived}`,
    );
    console.log(
      `Best aggregator handled small amount: ${result.bestQuote.aggregator}`,
    );
  } catch (error) {
    console.log(`Expected error with small amount: ${error.message}`);
  }

  // Test circuit breaker status
  console.log('\n🔌 Circuit Breaker Status:');
  const quoteStatus = multiAggregatorService.getCircuitBreakerStatus();
  const execStatus = aggregatorExecutionService.getCircuitBreakerStatus();

  console.log('Quote service:', JSON.stringify(quoteStatus, null, 2));
  console.log('Execution service:', JSON.stringify(execStatus, null, 2));
}

async function testSPXPriceComparison() {
  console.log('\n💰 Testing SPX6900 Price Comparison...\n');

  try {
    // Test 4: SPX6900 price comparison
    console.log('📊 Test 4: SPX6900 Price Comparison');
    console.log('='.repeat(50));

    const priceResult = await multiAggregatorService.getSPX6900Price();

    console.log(`Best SPX6900 price: $${priceResult.price}`);
    console.log(`Best aggregator: ${priceResult.bestAggregator}`);
    console.log('All prices:');
    priceResult.allPrices.forEach((price) => {
      console.log(
        `  ${price.aggregator}: $${price.price} (${price.responseTime}ms)`,
      );
    });
  } catch (error) {
    console.error('❌ SPX price comparison failed:', error);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Multi-Aggregator Integration Tests\n');
  console.log('='.repeat(60));

  await testMultiAggregatorQuotes();
  await testExecutableSwapData();
  await testErrorHandling();
  await testSPXPriceComparison();

  console.log('\n✅ All tests completed!');
  console.log('='.repeat(60));
}

// Export for running
export { runAllTests };

// Allow direct execution
if (require.main === module) {
  runAllTests().catch(console.error);
}
