import { ethers } from 'ethers';
import { type Address } from 'viem';

// DCA Automation Resolver contract ABI (essential functions only)
const DCA_CONTRACT_ABI = [
  {
    "inputs": [
      {"internalType": "bytes32", "name": "orderId", "type": "bytes32"},
      {"internalType": "address", "name": "user", "type": "address"},
      {"internalType": "address", "name": "smartWallet", "type": "address"},
      {"internalType": "string", "name": "agentKeyId", "type": "string"},
      {"internalType": "address", "name": "sellToken", "type": "address"},
      {"internalType": "address", "name": "buyToken", "type": "address"},
      {"internalType": "uint256", "name": "amountPerExecution", "type": "uint256"},
      {"internalType": "uint256", "name": "frequency", "type": "uint256"},
      {"internalType": "uint256", "name": "totalExecutions", "type": "uint256"}
    ],
    "name": "createOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "checker",
    "outputs": [
      {"internalType": "bool", "name": "canExec", "type": "bool"},
      {"internalType": "bytes", "name": "execPayload", "type": "bytes"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "orderId", "type": "bytes32"}],
    "name": "cancelOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "executor", "type": "address"}],
    "name": "authorizeExecutor",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "", "type": "address"}],
    "name": "authorizedExecutors",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  }
];

// Contract addresses
const DCA_CONTRACT_ADDRESS = '0xDb2a6DDD11ea1EAf060d88Bc964a3FE4E6128247' as const;

// Token addresses on Base (checksummed)
const TOKENS = {
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  SPX6900: '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C'
} as const;

export interface DCAOrderParams {
  user: Address;
  smartWallet: Address;
  agentKeyId: string;
  amountPerExecution: bigint;
  frequency: number; // in seconds
  totalExecutions: number;
}

export class DCAGelatoContractService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private wallet?: ethers.Wallet;

  constructor() {
    // Initialize provider (Base network)
    const rpcUrl = process.env.NEXT_PUBLIC_ZERODEV_RPC_URL || 'https://mainnet.base.org';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Initialize contract (read-only by default)
    this.contract = new ethers.Contract(DCA_CONTRACT_ADDRESS, DCA_CONTRACT_ABI, this.provider);
    
    // Initialize wallet if private key is available
    if (process.env.GELATO_DEPLOYER_PRIVATE_KEY) {
      this.wallet = new ethers.Wallet(process.env.GELATO_DEPLOYER_PRIVATE_KEY, this.provider);
      this.contract = this.contract.connect(this.wallet);
    }
  }

  /**
   * Generate a deterministic order ID from user address and timestamp
   */
  generateOrderId(userAddress: Address, timestamp: number): string {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256'],
        [userAddress, timestamp]
      )
    );
  }

  /**
   * Register a new DCA order with the Gelato automation contract
   */
  async createOrder(orderParams: DCAOrderParams, timestamp: number): Promise<{
    orderId: string;
    txHash?: string;
    success: boolean;
    error?: string;
  }> {
    try {
      if (!this.wallet) {
        console.warn('⚠️ No wallet configured for contract operations (read-only mode)');
        return {
          orderId: this.generateOrderId(orderParams.user, timestamp),
          success: false,
          error: 'No wallet configured for contract operations'
        };
      }

      const orderId = this.generateOrderId(orderParams.user, timestamp);
      
      console.log('📝 Registering order with Gelato contract...');
      console.log('   Order ID:', orderId);
      console.log('   Contract:', DCA_CONTRACT_ADDRESS);
      console.log('   User:', orderParams.user);
      console.log('   Smart Wallet:', orderParams.smartWallet);

      // Call createOrder on the smart contract
      const tx = await this.contract.createOrder(
        orderId,
        orderParams.user,
        orderParams.smartWallet,
        orderParams.agentKeyId,
        TOKENS.USDC, // sellToken
        TOKENS.SPX6900, // buyToken
        orderParams.amountPerExecution,
        orderParams.frequency,
        orderParams.totalExecutions
      );

      console.log('⏳ Transaction submitted:', tx.hash);
      
      // Wait for confirmation (don't block too long)
      const receipt = await tx.wait(1);
      console.log('✅ Order registered with Gelato contract!');
      console.log('   Block:', receipt.blockNumber);
      console.log('   Gas used:', receipt.gasUsed.toString());

      return {
        orderId,
        txHash: tx.hash,
        success: true
      };

    } catch (error) {
      console.error('❌ Failed to register order with contract:', error);
      
      let errorMessage = 'Unknown contract error';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        orderId: this.generateOrderId(orderParams.user, timestamp),
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Cancel an order in the contract
   */
  async cancelOrder(orderId: string): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
  }> {
    try {
      if (!this.wallet) {
        return {
          success: false,
          error: 'No wallet configured for contract operations'
        };
      }

      console.log('🚫 Cancelling order in contract:', orderId);
      
      const tx = await this.contract.cancelOrder(orderId);
      const receipt = await tx.wait(1);
      
      console.log('✅ Order cancelled in contract');
      
      return {
        success: true,
        txHash: tx.hash
      };

    } catch (error) {
      console.error('❌ Failed to cancel order in contract:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if any orders are ready for execution (for testing)
   */
  async checkReadyOrders(): Promise<{
    canExec: boolean;
    readyOrdersCount: number;
    error?: string;
  }> {
    try {
      const [canExec, execPayload] = await this.contract.checker();
      
      // Decode the payload to count ready orders
      let readyOrdersCount = 0;
      if (canExec && execPayload !== '0x') {
        try {
          // The payload contains encoded orderIds array
          const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['bytes32[]'], execPayload);
          readyOrdersCount = decoded[0].length;
        } catch {
          // If decoding fails, assume at least 1 order is ready
          readyOrdersCount = canExec ? 1 : 0;
        }
      }

      console.log('🔍 Checker result:', { canExec, readyOrdersCount });
      
      return {
        canExec,
        readyOrdersCount
      };

    } catch (error) {
      console.error('❌ Failed to check ready orders:', error);
      
      return {
        canExec: false,
        readyOrdersCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get contract info for debugging
   */
  getContractInfo() {
    return {
      address: DCA_CONTRACT_ADDRESS,
      hasWallet: !!this.wallet,
      walletAddress: this.wallet?.address,
      rpcUrl: this.provider._getConnection().url
    };
  }
}

// Export singleton instance
export const dcaGelatoContractService = new DCAGelatoContractService();