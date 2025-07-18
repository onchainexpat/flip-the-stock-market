import {
  http,
  type Address,
  createPublicClient,
  createWalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { TOKENS } from '../utils/openOceanApi';
import { serverAgentKeyService } from './serverAgentKeyService';

/**
 * Alternative DCA executor using direct wallet transactions
 * Bypasses ZeroDev SDK completely for testing
 */
export class AlternativeExecutor {
  private publicClient;
  private TOKENS = TOKENS;

  constructor() {
    this.publicClient = createPublicClient({
      chain: base,
      transport: http('https://mainnet.base.org'), // Use standard Base RPC
    });
  }

  async executeDCADirect(
    agentKeyId: string,
    smartWalletAddress: Address,
    swapAmount: bigint,
  ): Promise<{ success: boolean; error?: string; txHash?: string }> {
    try {
      console.log('🧪 Alternative execution (direct wallet)...');

      // Get agent private key
      const privateKey = await serverAgentKeyService.getPrivateKey(agentKeyId);
      if (!privateKey) {
        throw new Error('Agent private key not found');
      }

      // Create wallet client
      const account = privateKeyToAccount(privateKey);
      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http('https://mainnet.base.org'),
      });

      console.log('👤 Agent account:', account.address);
      console.log('🎯 Target wallet:', smartWalletAddress);

      // Check if agent has any ETH for gas
      const agentBalance = await this.publicClient.getBalance({
        address: account.address,
      });

      console.log('💰 Agent ETH balance:', agentBalance.toString());

      if (agentBalance === 0n) {
        return {
          success: false,
          error:
            'Agent has no ETH for gas fees. This test confirms ZeroDev paymaster is needed.',
        };
      }

      // Get swap quote from Aerodrome
      const aerodromeResponse = await fetch(
        'http://localhost:3000/api/aerodrome-swap',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sellToken: TOKENS.USDC,
            buyToken: TOKENS.SPX6900,
            sellAmount: swapAmount.toString(),
            takerAddress: smartWalletAddress,
          }),
        },
      );

      if (!aerodromeResponse.ok) {
        throw new Error('Failed to get Aerodrome quote');
      }

      const swapQuote = await aerodromeResponse.json();
      console.log('✅ Aerodrome quote obtained');

      // This test confirms the infrastructure works
      // but we can't actually execute without smart wallet permissions
      return {
        success: true,
        error:
          'Test successful - infrastructure working, but need ZeroDev smart wallet for actual execution',
      };
    } catch (error) {
      console.error('❌ Alternative execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const alternativeExecutor = new AlternativeExecutor();
