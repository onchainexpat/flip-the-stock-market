/**
 * Gelato Web3 Function for Automated DCA Execution
 *
 * This function runs on Gelato's decentralized network and executes DCA orders
 * automatically using multi-aggregator service for best rates.
 *
 * Features:
 * - Decentralized execution (no single point of failure)
 * - Multi-aggregator integration for best swap rates
 * - Gas-efficient batch processing
 * - Comprehensive error handling and monitoring
 */

import {
  Web3Function,
  type Web3FunctionContext,
} from '@gelatonetwork/web3-functions-sdk';
import { Contract } from 'ethers';

// Multi-aggregator service for best rates (embedded version)
class GelatoMultiAggregatorService {
  private readonly BASE_CHAIN_ID = 8453;
  private readonly REQUEST_TIMEOUT = 6000; // 6 seconds for Gelato

  async getBestSwapQuote(
    sellToken: string,
    buyToken: string,
    sellAmount: string,
    userAddress: string,
  ): Promise<{
    bestAggregator: string;
    buyAmount: string;
    to: string;
    data: string;
    value: string;
    gas: string;
  }> {
    const quotes = await Promise.allSettled([
      this.getOpenOceanQuote(sellToken, buyToken, sellAmount, userAddress),
      this.get1inchQuote(sellToken, buyToken, sellAmount, userAddress),
      this.getParaswapQuote(sellToken, buyToken, sellAmount, userAddress),
    ]);

    // Find successful quotes
    const validQuotes = quotes
      .map((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          return result.value;
        }
        console.log(
          `Aggregator ${index} failed:`,
          result.status === 'rejected' ? result.reason : 'Invalid response',
        );
        return null;
      })
      .filter(Boolean);

    if (validQuotes.length === 0) {
      throw new Error('No aggregators returned valid quotes');
    }

    // Return the best quote (highest buyAmount)
    const bestQuote = validQuotes.reduce((best, current) => {
      return BigInt(current.buyAmount) > BigInt(best.buyAmount)
        ? current
        : best;
    });

    console.log(
      `Best quote from ${bestQuote.bestAggregator}: ${bestQuote.buyAmount} tokens`,
    );
    return bestQuote;
  }

  private async getOpenOceanQuote(
    sellToken: string,
    buyToken: string,
    sellAmount: string,
    userAddress: string,
  ) {
    try {
      const params = new URLSearchParams({
        chain: this.BASE_CHAIN_ID.toString(),
        inTokenAddress: sellToken,
        outTokenAddress: buyToken,
        amountDecimals: sellAmount,
        account: userAddress,
        slippage: '1.5',
        gasPrice: '1000000000',
      });

      const response = await fetch(
        `https://open-api.openocean.finance/v4/${this.BASE_CHAIN_ID}/swap_quote?${params}`,
        {
          method: 'GET',
          headers: { 'User-Agent': 'Gelato-DCA-Function/1.0' },
        },
      );

      if (!response.ok) throw new Error(`OpenOcean error: ${response.status}`);

      const data = await response.json();
      if (!data.data || !data.outAmount)
        throw new Error('Invalid OpenOcean response');

      return {
        bestAggregator: 'OpenOcean',
        buyAmount: data.outAmount,
        to: data.to,
        data: data.data,
        value: data.value || '0',
        gas: data.estimatedGas || '300000',
      };
    } catch (error) {
      console.error('OpenOcean failed:', error);
      return null;
    }
  }

  private async get1inchQuote(
    sellToken: string,
    buyToken: string,
    sellAmount: string,
    userAddress: string,
  ) {
    try {
      const params = new URLSearchParams({
        fromTokenAddress: sellToken,
        toTokenAddress: buyToken,
        amount: sellAmount,
        fromAddress: userAddress,
        slippage: '1.5',
      });

      const response = await fetch(
        `https://api.1inch.dev/swap/v6.0/${this.BASE_CHAIN_ID}/swap?${params}`,
        {
          method: 'GET',
          headers: { Authorization: 'Bearer demo' }, // Replace with real API key
        },
      );

      if (!response.ok) throw new Error(`1inch error: ${response.status}`);

      const data = await response.json();
      if (!data.tx || !data.toTokenAmount)
        throw new Error('Invalid 1inch response');

      return {
        bestAggregator: '1inch',
        buyAmount: data.toTokenAmount,
        to: data.tx.to,
        data: data.tx.data,
        value: data.tx.value || '0',
        gas: data.tx.gas || '300000',
      };
    } catch (error) {
      console.error('1inch failed:', error);
      return null;
    }
  }

  private async getParaswapQuote(
    sellToken: string,
    buyToken: string,
    sellAmount: string,
    userAddress: string,
  ) {
    try {
      // First get price route
      const priceParams = new URLSearchParams({
        srcToken: sellToken,
        destToken: buyToken,
        srcAmount: sellAmount,
        userAddress,
        side: 'SELL',
        network: this.BASE_CHAIN_ID.toString(),
      });

      const priceResponse = await fetch(
        `https://apiv5.paraswap.io/prices/?${priceParams}`,
      );
      if (!priceResponse.ok)
        throw new Error(`Paraswap price error: ${priceResponse.status}`);

      const priceData = await priceResponse.json();
      if (!priceData.priceRoute) throw new Error('No Paraswap price route');

      // Get transaction data
      const txResponse = await fetch(
        'https://apiv5.paraswap.io/transactions/8453',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            srcToken: sellToken,
            destToken: buyToken,
            srcAmount: sellAmount,
            destAmount: priceData.priceRoute.destAmount,
            userAddress,
            priceRoute: priceData.priceRoute,
            slippage: 150, // 1.5% in basis points
          }),
        },
      );

      if (!txResponse.ok)
        throw new Error(`Paraswap tx error: ${txResponse.status}`);

      const txData = await txResponse.json();
      if (!txData.data) throw new Error('No Paraswap transaction data');

      return {
        bestAggregator: 'Paraswap',
        buyAmount: priceData.priceRoute.destAmount,
        to: txData.to,
        data: txData.data,
        value: txData.value || '0',
        gas: txData.gas || '300000',
      };
    } catch (error) {
      console.error('Paraswap failed:', error);
      return null;
    }
  }
}

// DCA Order interface
interface DCAOrder {
  id: string;
  userAddress: string;
  smartWalletAddress: string;
  agentKeyId: string;
  sellToken: string;
  buyToken: string;
  amountPerExecution: string;
  frequency: number; // seconds
  totalExecutions: number;
  executionsCompleted: number;
  lastExecutionTime: number;
  nextExecutionTime: number;
  isActive: boolean;
}

// ERC20 ABI (minimal)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const { userArgs, storage, provider } = context;

  console.log('🤖 Gelato DCA Automation Function Started');

  try {
    // Configuration from userArgs
    const REDIS_URL = userArgs.redisUrl as string;
    const ENCRYPTION_SECRET = userArgs.encryptionSecret as string;
    const ZERODEV_RPC_URL = userArgs.zerodevRpcUrl as string;

    // Token addresses on Base
    const TOKENS = {
      USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      SPX6900: '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C',
    };

    // Initialize multi-aggregator service
    const multiAggregator = new GelatoMultiAggregatorService();

    // Get current timestamp
    const now = Math.floor(Date.now() / 1000);

    // Mock function to get DCA orders ready for execution
    // In production, this would connect to your Redis database
    const getReadyOrders = async (): Promise<DCAOrder[]> => {
      // This is a mock - replace with actual Redis/database query
      console.log('📋 Checking for orders ready for execution...');

      // Example orders (replace with real database query)
      const mockOrders: DCAOrder[] = [
        {
          id: 'order_123',
          userAddress: '0x742E4e12936393F21CAcEE8087Db76bF304E4534',
          smartWalletAddress: '0x1234567890123456789012345678901234567890',
          agentKeyId: 'agent_456',
          sellToken: TOKENS.USDC,
          buyToken: TOKENS.SPX6900,
          amountPerExecution: '5000000', // 5 USDC
          frequency: 3600, // 1 hour
          totalExecutions: 24, // 24 times (daily for a day)
          executionsCompleted: 5,
          lastExecutionTime: now - 3700, // Over an hour ago
          nextExecutionTime: now - 100, // Ready now
          isActive: true,
        },
      ];

      return mockOrders.filter(
        (order) =>
          order.isActive &&
          order.executionsCompleted < order.totalExecutions &&
          order.nextExecutionTime <= now,
      );
    };

    // Get orders ready for execution
    const readyOrders = await getReadyOrders();
    console.log(`📊 Found ${readyOrders.length} orders ready for execution`);

    if (readyOrders.length === 0) {
      return {
        canExec: false,
        message: 'No DCA orders ready for execution',
      };
    }

    // Process up to 5 orders per execution (gas limit consideration)
    const ordersToProcess = readyOrders.slice(0, 5);
    const results = [];

    for (const order of ordersToProcess) {
      try {
        console.log(`🔄 Processing order ${order.id}...`);

        // Check USDC balance
        const usdcContract = new Contract(order.sellToken, ERC20_ABI, provider);
        const balance = await usdcContract.balanceOf(order.smartWalletAddress);

        if (balance.lt(order.amountPerExecution)) {
          console.log(`❌ Order ${order.id}: Insufficient USDC balance`);
          results.push({
            orderId: order.id,
            success: false,
            error: 'Insufficient USDC balance',
          });
          continue;
        }

        // Get best swap quote using multi-aggregator
        const swapQuote = await multiAggregator.getBestSwapQuote(
          order.sellToken,
          order.buyToken,
          order.amountPerExecution,
          order.smartWalletAddress,
        );

        console.log(
          `✅ Order ${order.id}: Best rate from ${swapQuote.bestAggregator}`,
        );
        console.log(`   Expected output: ${swapQuote.buyAmount} tokens`);

        // In a real implementation, you would:
        // 1. Use the stored agent key to sign transactions
        // 2. Execute the swap via ZeroDev smart wallet
        // 3. Transfer resulting tokens to user wallet
        // 4. Update order status in database

        results.push({
          orderId: order.id,
          success: true,
          aggregator: swapQuote.bestAggregator,
          outputAmount: swapQuote.buyAmount,
          gasEstimate: swapQuote.gas,
        });
      } catch (error) {
        console.error(`❌ Order ${order.id} failed:`, error);
        results.push({
          orderId: order.id,
          success: false,
          error: error.message,
        });
      }
    }

    const successfulOrders = results.filter((r) => r.success).length;
    console.log(
      `📈 Processed ${ordersToProcess.length} orders, ${successfulOrders} successful`,
    );

    // Return execution result
    return {
      canExec: true,
      callData: [], // In real implementation, return transaction data
      message: `Processed ${ordersToProcess.length} DCA orders (${successfulOrders} successful)`,
    };
  } catch (error) {
    console.error('❌ Gelato DCA Function Error:', error);
    return {
      canExec: false,
      message: `Function error: ${error.message}`,
    };
  }
});

export default Web3Function.onRun;
