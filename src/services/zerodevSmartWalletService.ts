import { type Address } from 'viem';
import { zerodevDCAService, type DCAAgentConfig } from './zerodevDCAService';
import { agentKeyService } from './agentKeyService';

export interface SmartWalletConfig {
  walletId: string;
  smartWalletAddress: Address;
  agentAddress: Address;
  userWalletAddress: Address;
  agentKeyId: string;
  createdAt: number;
  isActive: boolean;
}

export interface WalletCreationResult {
  success: boolean;
  walletConfig?: SmartWalletConfig;
  error?: string;
}

export interface WalletBalances {
  smartWalletUSDC: bigint;
  smartWalletSPX: bigint;
  userWalletUSDC: bigint;
  userWalletSPX: bigint;
}

export class ZeroDevSmartWalletService {
  private readonly STORAGE_KEY = 'dca_smart_wallets';

  /**
   * Create a new smart wallet with agent key
   */
  async createSmartWallet(
    userWalletAddress: Address,
    password: string,
    walletName?: string
  ): Promise<WalletCreationResult> {
    try {
      // Generate new agent key
      const agentKeyData = agentKeyService.generateAgentKey();
      
      // Create smart wallet
      const { smartWalletAddress, agentAddress } = await zerodevDCAService.createSmartWallet(
        agentKeyData.privateKey
      );
      
      // Store agent key
      const agentKeyId = await agentKeyService.storeAgentKey(
        agentKeyData,
        password,
        smartWalletAddress
      );
      
      // Create wallet configuration
      const walletId = `wallet_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const walletConfig: SmartWalletConfig = {
        walletId,
        smartWalletAddress,
        agentAddress,
        userWalletAddress,
        agentKeyId,
        createdAt: Date.now(),
        isActive: true,
      };
      
      // Store wallet configuration
      this.storeWalletConfig(walletConfig);
      
      return {
        success: true,
        walletConfig,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create smart wallet: ${error}`,
      };
    }
  }

  /**
   * Get DCA agent config for a wallet
   */
  async getDCAAgentConfig(walletId: string, password: string): Promise<DCAAgentConfig> {
    try {
      const walletConfig = this.getWalletConfig(walletId);
      if (!walletConfig) {
        throw new Error('Wallet not found');
      }
      
      const agentKeyData = await agentKeyService.retrieveAgentKey(
        walletConfig.agentKeyId,
        password
      );
      
      return {
        privateKey: agentKeyData.privateKey,
        smartWalletAddress: walletConfig.smartWalletAddress,
        userWalletAddress: walletConfig.userWalletAddress,
      };
    } catch (error) {
      throw new Error(`Failed to get DCA agent config: ${error}`);
    }
  }

  /**
   * Get wallet balances
   */
  async getWalletBalances(walletId: string): Promise<WalletBalances> {
    try {
      const walletConfig = this.getWalletConfig(walletId);
      if (!walletConfig) {
        throw new Error('Wallet not found');
      }

      const [smartWalletUSDC, smartWalletSPX, userWalletUSDC, userWalletSPX] = await Promise.all([
        zerodevDCAService.getUSDCBalance(walletConfig.smartWalletAddress),
        zerodevDCAService.getSPXBalance(walletConfig.smartWalletAddress),
        zerodevDCAService.getUSDCBalance(walletConfig.userWalletAddress),
        zerodevDCAService.getSPXBalance(walletConfig.userWalletAddress),
      ]);

      return {
        smartWalletUSDC,
        smartWalletSPX,
        userWalletUSDC,
        userWalletSPX,
      };
    } catch (error) {
      throw new Error(`Failed to get wallet balances: ${error}`);
    }
  }

  /**
   * Execute DCA swap
   */
  async executeDCASwap(
    walletId: string,
    swapAmount: bigint,
    password: string
  ): Promise<{
    success: boolean;
    transactionHash?: string;
    error?: string;
  }> {
    try {
      const agentConfig = await this.getDCAAgentConfig(walletId, password);
      
      const result = await zerodevDCAService.executeDCASwap(agentConfig, swapAmount);
      
      return {
        success: result.success,
        transactionHash: result.transactionHash,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to execute DCA swap: ${error}`,
      };
    }
  }

  /**
   * List all stored wallets
   */
  listWallets(): SmartWalletConfig[] {
    const storedWallets = this.getStoredWallets();
    return Object.values(storedWallets).filter(wallet => wallet.isActive);
  }

  /**
   * Get specific wallet configuration
   */
  getWalletConfig(walletId: string): SmartWalletConfig | null {
    const storedWallets = this.getStoredWallets();
    return storedWallets[walletId] || null;
  }

  /**
   * Deactivate a wallet (soft delete)
   */
  deactivateWallet(walletId: string): boolean {
    try {
      const storedWallets = this.getStoredWallets();
      
      if (!(walletId in storedWallets)) {
        return false;
      }
      
      storedWallets[walletId].isActive = false;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storedWallets));
      
      return true;
    } catch (error) {
      console.error('Failed to deactivate wallet:', error);
      return false;
    }
  }

  /**
   * Validate wallet access
   */
  async validateWalletAccess(walletId: string, password: string): Promise<boolean> {
    try {
      const walletConfig = this.getWalletConfig(walletId);
      if (!walletConfig) {
        return false;
      }
      
      return await agentKeyService.validateKeyAccess(walletConfig.agentKeyId, password);
    } catch (error) {
      return false;
    }
  }

  /**
   * Update user wallet address
   */
  updateUserWalletAddress(walletId: string, newUserWalletAddress: Address): boolean {
    try {
      const storedWallets = this.getStoredWallets();
      
      if (!(walletId in storedWallets)) {
        return false;
      }
      
      storedWallets[walletId].userWalletAddress = newUserWalletAddress;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storedWallets));
      
      return true;
    } catch (error) {
      console.error('Failed to update user wallet address:', error);
      return false;
    }
  }

  /**
   * Get wallet summary for display
   */
  getWalletSummary(walletId: string): {
    smartWalletAddress: Address;
    userWalletAddress: Address;
    createdAt: number;
    isActive: boolean;
  } | null {
    const config = this.getWalletConfig(walletId);
    if (!config) {
      return null;
    }
    
    return {
      smartWalletAddress: config.smartWalletAddress,
      userWalletAddress: config.userWalletAddress,
      createdAt: config.createdAt,
      isActive: config.isActive,
    };
  }

  /**
   * Store wallet configuration
   */
  private storeWalletConfig(config: SmartWalletConfig): void {
    const storedWallets = this.getStoredWallets();
    storedWallets[config.walletId] = config;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storedWallets));
  }

  /**
   * Get stored wallets from localStorage
   */
  private getStoredWallets(): Record<string, SmartWalletConfig> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to get stored wallets:', error);
      return {};
    }
  }

  /**
   * Clear all stored wallets (use with caution!)
   */
  clearAllWallets(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

// Export singleton instance
export const zerodevSmartWalletService = new ZeroDevSmartWalletService();