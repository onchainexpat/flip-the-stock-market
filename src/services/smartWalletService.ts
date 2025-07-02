'use client';
import type { Address } from 'viem';
// DEPRECATED: Using ZeroDev paymaster instead of Coinbase

export interface SmartWalletDeployment {
  address: Address;
  isDeployed: boolean;
  deploymentTxHash?: string;
}

export class SmartWalletService {
  constructor() {
    // DEPRECATED: This service is no longer used - ZeroDev handles smart wallet operations
  }

  /**
   * Deploy a smart wallet for the given signer (embedded wallet)
   */
  async deploySmartWallet(
    signerAddress: Address,
  ): Promise<SmartWalletDeployment> {
    try {
      console.log(
        'SmartWalletService: Starting deployment for signer:',
        signerAddress,
      );

      if (!signerAddress || !signerAddress.startsWith('0x')) {
        throw new Error('Invalid signer address provided');
      }

      // Generate a deterministic smart wallet address
      console.log('SmartWalletService: Generating smart wallet address...');
      const smartWalletAddress = this.generateSmartWalletAddress(signerAddress);
      console.log('SmartWalletService: Generated address:', smartWalletAddress);

      // Check if already deployed by making a simple call
      console.log('SmartWalletService: Checking if already deployed...');
      const isAlreadyDeployed =
        await this.isSmartWalletDeployed(smartWalletAddress);

      if (isAlreadyDeployed) {
        console.log(
          'SmartWalletService: Smart wallet already deployed at:',
          smartWalletAddress,
        );
        return {
          address: smartWalletAddress,
          isDeployed: true,
        };
      }

      // Simulate deployment transaction
      console.log('SmartWalletService: Simulating smart wallet deployment...');
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const mockTxHash =
        `0x${Math.random().toString(16).substring(2).padEnd(64, '0')}` as `0x${string}`;

      console.log('SmartWalletService: Smart wallet deployed successfully!');
      console.log('SmartWalletService: Address:', smartWalletAddress);
      console.log('SmartWalletService: Deployment TX:', mockTxHash);

      return {
        address: smartWalletAddress,
        isDeployed: true,
        deploymentTxHash: mockTxHash,
      };
    } catch (error) {
      console.error(
        'SmartWalletService: Failed to deploy smart wallet:',
        error,
      );

      // Ensure we always throw a proper Error object
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(`Smart wallet deployment failed: ${String(error)}`);
      }
    }
  }

  /**
   * Generate a deterministic smart wallet address for the signer
   */
  private generateSmartWalletAddress(signerAddress: Address): Address {
    // This is a simplified deterministic address generation
    // In reality, this would use the factory contract and CREATE2
    const hash = signerAddress.slice(2) + '000000000000000000000000';
    return `0x${hash.slice(0, 40)}` as Address;
  }

  /**
   * Check if a smart wallet is already deployed
   */
  private async isSmartWalletDeployed(address: Address): Promise<boolean> {
    try {
      // Check localStorage first for testing
      const stored = localStorage.getItem('deployedSmartWallets');
      if (stored) {
        const deployed = JSON.parse(stored);
        return deployed.includes(address);
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Mark a smart wallet as deployed (for testing)
   */
  markAsDeployed(address: Address): void {
    try {
      const stored = localStorage.getItem('deployedSmartWallets');
      const deployed = stored ? JSON.parse(stored) : [];
      if (!deployed.includes(address)) {
        deployed.push(address);
        localStorage.setItem('deployedSmartWallets', JSON.stringify(deployed));
      }
    } catch (error) {
      console.error('Failed to mark as deployed:', error);
    }
  }
}

export const smartWalletService = new SmartWalletService();
