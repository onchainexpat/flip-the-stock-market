import { type Address, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

export interface AgentKeyData {
  privateKey: Hex;
  address: Address;
  createdAt: number;
  smartWalletAddress?: Address;
}

export interface StoredAgentConfig {
  keyId: string;
  encryptedPrivateKey: string;
  address: Address;
  smartWalletAddress?: Address;
  createdAt: number;
}

export class AgentKeyService {
  private readonly STORAGE_KEY = 'dca_agent_keys';
  private readonly ENCRYPTION_KEY = 'dca_encryption_key';

  /**
   * Generate a new agent private key
   */
  generateAgentKey(): AgentKeyData {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    
    return {
      privateKey,
      address: account.address,
      createdAt: Date.now(),
    };
  }

  /**
   * Simple encryption using Web Crypto API
   */
  private async encryptPrivateKey(privateKey: Hex, password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(privateKey);
    
    // Create a simple key from password (in production, use proper key derivation)
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('dca-salt'), // Use random salt in production
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Simple decryption using Web Crypto API
   */
  private async decryptPrivateKey(encryptedData: string, password: string): Promise<Hex> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Decode base64
    const combined = new Uint8Array(
      atob(encryptedData)
        .split('')
        .map(char => char.charCodeAt(0))
    );
    
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    // Create key from password
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('dca-salt'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    return decoder.decode(decrypted) as Hex;
  }

  /**
   * Store agent key securely in localStorage
   */
  async storeAgentKey(
    keyData: AgentKeyData,
    password: string,
    smartWalletAddress?: Address
  ): Promise<string> {
    try {
      const keyId = `agent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const encryptedPrivateKey = await this.encryptPrivateKey(keyData.privateKey, password);
      
      const storedConfig: StoredAgentConfig = {
        keyId,
        encryptedPrivateKey,
        address: keyData.address,
        smartWalletAddress,
        createdAt: keyData.createdAt,
      };
      
      // Get existing keys
      const existingKeys = this.getStoredKeys();
      existingKeys[keyId] = storedConfig;
      
      // Store in localStorage
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existingKeys));
      
      return keyId;
    } catch (error) {
      throw new Error(`Failed to store agent key: ${error}`);
    }
  }

  /**
   * Retrieve agent key from storage
   */
  async retrieveAgentKey(keyId: string, password: string): Promise<AgentKeyData> {
    try {
      const storedKeys = this.getStoredKeys();
      const storedConfig = storedKeys[keyId];
      
      if (!storedConfig) {
        throw new Error('Agent key not found');
      }
      
      const privateKey = await this.decryptPrivateKey(storedConfig.encryptedPrivateKey, password);
      
      return {
        privateKey,
        address: storedConfig.address,
        createdAt: storedConfig.createdAt,
        smartWalletAddress: storedConfig.smartWalletAddress,
      };
    } catch (error) {
      throw new Error(`Failed to retrieve agent key: ${error}`);
    }
  }

  /**
   * List all stored agent keys (without private keys)
   */
  listStoredKeys(): Array<{
    keyId: string;
    address: Address;
    smartWalletAddress?: Address;
    createdAt: number;
  }> {
    const storedKeys = this.getStoredKeys();
    
    return Object.values(storedKeys).map(config => ({
      keyId: config.keyId,
      address: config.address,
      smartWalletAddress: config.smartWalletAddress,
      createdAt: config.createdAt,
    }));
  }

  /**
   * Delete a stored agent key
   */
  deleteAgentKey(keyId: string): boolean {
    try {
      const storedKeys = this.getStoredKeys();
      
      if (!(keyId in storedKeys)) {
        return false;
      }
      
      delete storedKeys[keyId];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storedKeys));
      
      return true;
    } catch (error) {
      console.error('Failed to delete agent key:', error);
      return false;
    }
  }

  /**
   * Update smart wallet address for a stored key
   */
  updateSmartWalletAddress(keyId: string, smartWalletAddress: Address): boolean {
    try {
      const storedKeys = this.getStoredKeys();
      
      if (!(keyId in storedKeys)) {
        return false;
      }
      
      storedKeys[keyId].smartWalletAddress = smartWalletAddress;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storedKeys));
      
      return true;
    } catch (error) {
      console.error('Failed to update smart wallet address:', error);
      return false;
    }
  }

  /**
   * Get stored keys from localStorage
   */
  private getStoredKeys(): Record<string, StoredAgentConfig> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to get stored keys:', error);
      return {};
    }
  }

  /**
   * Clear all stored keys (use with caution!)
   */
  clearAllKeys(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Validate if a key exists and is accessible
   */
  async validateKeyAccess(keyId: string, password: string): Promise<boolean> {
    try {
      await this.retrieveAgentKey(keyId, password);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const agentKeyService = new AgentKeyService();