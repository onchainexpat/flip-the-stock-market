import { webcrypto } from 'crypto';
import { Redis } from '@upstash/redis';
import type { Address, Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

// Lazy Redis client initialization
let redisClient: Redis | null = null;
function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redisClient;
}

// Server-side encryption key getter with validation
function getEncryptionKey(): string {
  const key = process.env.AGENT_KEY_ENCRYPTION_SECRET;
  if (!key || key.length < 32) {
    throw new Error(
      'AGENT_KEY_ENCRYPTION_SECRET must be set and at least 32 characters long',
    );
  }
  return key;
}

export interface ServerAgentKey {
  keyId: string;
  userAddress: Address;
  agentAddress: Address;
  smartWalletAddress?: Address;
  encryptedPrivateKey: string;
  sessionKeyApproval?: string; // Serialized ZeroDev permission account
  provider?: 'zerodev' | 'gelato'; // Track which provider this key is for
  createdAt: number;
  lastUsedAt?: number;
  isActive: boolean;
}

// Redis keys
const REDIS_KEYS = {
  AGENT_KEY: (keyId: string) => `agent:key:${keyId}`,
  USER_AGENT_KEYS: (userAddress: string) => `agent:user:${userAddress}:keys`,
  AGENT_KEY_BY_WALLET: (smartWalletAddress: string) =>
    `agent:wallet:${smartWalletAddress}:key`,
};

export class ServerAgentKeyService {
  /**
   * Encrypt private key using Web Crypto API
   */
  private async encryptPrivateKey(privateKey: Hex): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(privateKey);

    // Generate random salt and IV
    const salt = webcrypto.getRandomValues(new Uint8Array(32));
    const iv = webcrypto.getRandomValues(new Uint8Array(12));

    // Import the master key
    const keyMaterial = await webcrypto.subtle.importKey(
      'raw',
      encoder.encode(getEncryptionKey()),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey'],
    );

    // Derive encryption key
    const key = await webcrypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt'],
    );

    // Encrypt the data
    const encrypted = await webcrypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data,
    );

    // Combine salt, iv, and encrypted data
    const combined = new Uint8Array(
      salt.length + iv.length + encrypted.byteLength,
    );
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);

    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Decrypt private key using Web Crypto API
   */
  private async decryptPrivateKey(encryptedData: string): Promise<Hex> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Decode base64
    const combined = new Uint8Array(
      atob(encryptedData)
        .split('')
        .map((char) => char.charCodeAt(0)),
    );

    // Extract components
    const salt = combined.slice(0, 32);
    const iv = combined.slice(32, 44);
    const encrypted = combined.slice(44);

    // Import the master key
    const keyMaterial = await webcrypto.subtle.importKey(
      'raw',
      encoder.encode(getEncryptionKey()),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey'],
    );

    // Derive decryption key
    const key = await webcrypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );

    // Decrypt the data
    const decrypted = await webcrypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted,
    );

    return decoder.decode(decrypted) as Hex;
  }

  /**
   * Store a session key for automated execution
   */
  async storeSessionKey(
    userAddress: Address,
    smartWalletAddress: Address,
    sessionPrivateKey: Hex,
    sessionKeyApproval?: string,
  ): Promise<ServerAgentKey> {
    try {
      console.log('🔧 DEBUG: Starting storeSessionKey');

      // Create session account to get the address
      const sessionAccount = privateKeyToAccount(sessionPrivateKey);

      console.log('🔧 DEBUG: Creating key ID');
      const keyId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      console.log('🔧 DEBUG: Encrypting session private key');
      const encryptedPrivateKey =
        await this.encryptPrivateKey(sessionPrivateKey);

      console.log('🔧 DEBUG: Creating session key object');
      const agentKey: ServerAgentKey = {
        keyId,
        userAddress,
        agentAddress: sessionAccount.address,
        smartWalletAddress,
        encryptedPrivateKey,
        sessionKeyApproval,
        createdAt: Date.now(),
        isActive: true,
      };

      console.log('🔧 DEBUG: Storing in Redis');
      // Store in Redis
      await getRedisClient().set(
        REDIS_KEYS.AGENT_KEY(keyId),
        JSON.stringify(agentKey),
      );
      await getRedisClient().sadd(
        REDIS_KEYS.USER_AGENT_KEYS(userAddress),
        keyId,
      );
      await getRedisClient().set(
        REDIS_KEYS.AGENT_KEY_BY_WALLET(smartWalletAddress),
        keyId,
      );

      console.log(`✅ Stored session key ${keyId} for user ${userAddress}`);
      console.log(`   Session address: ${sessionAccount.address}`);
      console.log(`   Smart wallet: ${smartWalletAddress}`);

      return agentKey;
    } catch (error) {
      console.error('❌ DEBUG: Error in storeSessionKey:', error);
      throw error;
    }
  }

  /**
   * Generate a new agent key for a user
   */
  async generateAgentKey(userAddress: Address): Promise<ServerAgentKey> {
    try {
      console.log('🔧 DEBUG: Starting generateAgentKey');

      console.log('🔧 DEBUG: Generating private key');
      const privateKey = generatePrivateKey();
      const agentAccount = privateKeyToAccount(privateKey);

      console.log('🔧 DEBUG: Creating key ID');
      const keyId = `agent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      console.log('🔧 DEBUG: Encrypting private key');
      const encryptedPrivateKey = await this.encryptPrivateKey(privateKey);

      console.log('🔧 DEBUG: Creating agent key object');
      const agentKey: ServerAgentKey = {
        keyId,
        userAddress,
        agentAddress: agentAccount.address,
        encryptedPrivateKey,
        createdAt: Date.now(),
        isActive: true,
      };

      console.log('🔧 DEBUG: Storing in Redis');
      // Store in Redis
      await getRedisClient().set(
        REDIS_KEYS.AGENT_KEY(keyId),
        JSON.stringify(agentKey),
      );
      await getRedisClient().sadd(
        REDIS_KEYS.USER_AGENT_KEYS(userAddress),
        keyId,
      );

      console.log(`✅ Generated agent key ${keyId} for user ${userAddress}`);
      console.log(`   Agent address: ${agentAccount.address}`);

      return agentKey;
    } catch (error) {
      console.error('❌ DEBUG: Error in generateAgentKey:', error);
      throw error;
    }
  }

  /**
   * Get decrypted private key for execution
   */
  async getPrivateKey(keyId: string): Promise<Hex | null> {
    const agentKeyData = await getRedisClient().get(
      REDIS_KEYS.AGENT_KEY(keyId),
    );
    if (!agentKeyData) return null;

    let agentKey: ServerAgentKey;
    if (typeof agentKeyData === 'string') {
      agentKey = JSON.parse(agentKeyData) as ServerAgentKey;
    } else if (typeof agentKeyData === 'object') {
      agentKey = agentKeyData as ServerAgentKey;
    } else {
      throw new Error('Invalid agent key data format');
    }
    if (!agentKey.isActive) return null;

    // Update last used timestamp
    agentKey.lastUsedAt = Date.now();
    await getRedisClient().set(
      REDIS_KEYS.AGENT_KEY(keyId),
      JSON.stringify(agentKey),
    );

    return await this.decryptPrivateKey(agentKey.encryptedPrivateKey);
  }

  /**
   * Get agent key by smart wallet address
   */
  async getAgentKeyByWallet(
    smartWalletAddress: Address,
  ): Promise<ServerAgentKey | null> {
    const keyId = await getRedisClient().get(
      REDIS_KEYS.AGENT_KEY_BY_WALLET(smartWalletAddress),
    );
    if (!keyId) return null;

    const agentKeyData = await getRedisClient().get(
      REDIS_KEYS.AGENT_KEY(keyId as string),
    );
    if (!agentKeyData) return null;

    return JSON.parse(agentKeyData as string) as ServerAgentKey;
  }

  /**
   * Update agent key with smart wallet address
   */
  async updateSmartWalletAddress(
    keyId: string,
    smartWalletAddress: Address,
  ): Promise<boolean> {
    const agentKeyData = await getRedisClient().get(
      REDIS_KEYS.AGENT_KEY(keyId),
    );
    if (!agentKeyData) return false;

    let agentKey: ServerAgentKey;
    if (typeof agentKeyData === 'string') {
      agentKey = JSON.parse(agentKeyData) as ServerAgentKey;
    } else if (typeof agentKeyData === 'object') {
      agentKey = agentKeyData as ServerAgentKey;
    } else {
      throw new Error('Invalid agent key data format');
    }
    agentKey.smartWalletAddress = smartWalletAddress;

    await getRedisClient().set(
      REDIS_KEYS.AGENT_KEY(keyId),
      JSON.stringify(agentKey),
    );
    await getRedisClient().set(
      REDIS_KEYS.AGENT_KEY_BY_WALLET(smartWalletAddress),
      keyId,
    );

    return true;
  }

  /**
   * Get all agent keys for a user
   */
  async getUserAgentKeys(userAddress: Address): Promise<ServerAgentKey[]> {
    const keyIds = await getRedisClient().smembers(
      REDIS_KEYS.USER_AGENT_KEYS(userAddress),
    );
    const agentKeys: ServerAgentKey[] = [];

    for (const keyId of keyIds) {
      const agentKeyData = await getRedisClient().get(
        REDIS_KEYS.AGENT_KEY(keyId),
      );
      if (agentKeyData) {
        agentKeys.push(JSON.parse(agentKeyData as string) as ServerAgentKey);
      }
    }

    return agentKeys.filter((key) => key.isActive);
  }

  /**
   * Deactivate an agent key
   */
  async deactivateAgentKey(keyId: string): Promise<boolean> {
    const agentKeyData = await getRedisClient().get(
      REDIS_KEYS.AGENT_KEY(keyId),
    );
    if (!agentKeyData) return false;

    let agentKey: ServerAgentKey;
    if (typeof agentKeyData === 'string') {
      agentKey = JSON.parse(agentKeyData) as ServerAgentKey;
    } else if (typeof agentKeyData === 'object') {
      agentKey = agentKeyData as ServerAgentKey;
    } else {
      throw new Error('Invalid agent key data format');
    }
    agentKey.isActive = false;

    await getRedisClient().set(
      REDIS_KEYS.AGENT_KEY(keyId),
      JSON.stringify(agentKey),
    );

    return true;
  }

  /**
   * Get agent key by ID (without private key but with approval)
   */
  async getAgentKey(keyId: string): Promise<ServerAgentKey | null> {
    const agentKeyData = await getRedisClient().get(
      REDIS_KEYS.AGENT_KEY(keyId),
    );
    if (!agentKeyData) return null;

    let agentKey: ServerAgentKey;
    if (typeof agentKeyData === 'string') {
      agentKey = JSON.parse(agentKeyData) as ServerAgentKey;
    } else if (typeof agentKeyData === 'object') {
      agentKey = agentKeyData as ServerAgentKey;
    } else {
      throw new Error('Invalid agent key data format');
    }
    // Remove encrypted private key before returning but keep approval
    const { encryptedPrivateKey, ...safeAgentKey } = agentKey;

    // Ensure sessionKeyApproval is preserved
    const result = safeAgentKey as ServerAgentKey;
    result.sessionKeyApproval = agentKey.sessionKeyApproval;

    return result;
  }

  /**
   * Update agent key properties
   */
  async updateAgentKey(
    keyId: string,
    updates: Partial<ServerAgentKey>,
  ): Promise<boolean> {
    const agentKeyData = await getRedisClient().get(
      REDIS_KEYS.AGENT_KEY(keyId),
    );
    if (!agentKeyData) return false;

    let agentKey: ServerAgentKey;
    if (typeof agentKeyData === 'string') {
      agentKey = JSON.parse(agentKeyData) as ServerAgentKey;
    } else if (typeof agentKeyData === 'object') {
      agentKey = agentKeyData as ServerAgentKey;
    } else {
      throw new Error('Invalid agent key data format');
    }
    const updatedKey = { ...agentKey, ...updates };

    await getRedisClient().set(
      REDIS_KEYS.AGENT_KEY(keyId),
      JSON.stringify(updatedKey),
    );

    // Update smart wallet index if needed
    if (
      updates.smartWalletAddress &&
      updates.smartWalletAddress !== agentKey.smartWalletAddress
    ) {
      await getRedisClient().set(
        REDIS_KEYS.AGENT_KEY_BY_WALLET(updates.smartWalletAddress),
        keyId,
      );
    }

    return true;
  }

  /**
   * Store a Gelato agent key for gasless DCA automation
   */
  async storeGelatoAgentKey(
    userAddress: Address,
    smartWalletAddress: Address,
    agentPrivateKey: Hex,
    agentAddress: Address,
  ): Promise<ServerAgentKey> {
    try {
      console.log('🔧 DEBUG: Starting storeGelatoAgentKey');

      const keyId = `gelato_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      console.log('🔧 DEBUG: Encrypting agent private key');
      const encryptedPrivateKey = await this.encryptPrivateKey(agentPrivateKey);

      console.log('🔧 DEBUG: Creating Gelato agent key object');
      const agentKey: ServerAgentKey = {
        keyId,
        userAddress,
        agentAddress,
        smartWalletAddress,
        encryptedPrivateKey,
        provider: 'gelato',
        createdAt: Date.now(),
        isActive: true,
      };

      console.log('🔧 DEBUG: Storing in Redis');
      // Store in Redis
      await getRedisClient().set(
        REDIS_KEYS.AGENT_KEY(keyId),
        JSON.stringify(agentKey),
      );
      await getRedisClient().sadd(
        REDIS_KEYS.USER_AGENT_KEYS(userAddress),
        keyId,
      );
      await getRedisClient().set(
        REDIS_KEYS.AGENT_KEY_BY_WALLET(smartWalletAddress),
        keyId,
      );

      console.log(
        `✅ Stored Gelato agent key ${keyId} for user ${userAddress}`,
      );
      console.log(`   Agent address: ${agentAddress}`);
      console.log(`   Smart wallet: ${smartWalletAddress}`);
      console.log(`   Provider: gelato`);

      return agentKey;
    } catch (error) {
      console.error('❌ DEBUG: Error in storeGelatoAgentKey:', error);
      throw error;
    }
  }

  /**
   * Store Gelato Native agent key with simplified metadata
   * This is for the new EIP-7702 approach where EOA = Smart Wallet
   */
  async storeAgentKey(
    userAddress: Address,
    smartWalletAddress: Address,
    agentPrivateKey: Hex,
    metadata: any,
  ): Promise<ServerAgentKey> {
    try {
      console.log('🔧 Storing Gelato Native agent key...');
      console.log('   User:', userAddress);
      console.log('   Smart wallet:', smartWalletAddress);
      console.log('   Provider:', metadata.provider);

      const agentAccount = privateKeyToAccount(agentPrivateKey);
      const keyId = `${metadata.provider}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Encrypt the private key
      const encryptedPrivateKey = await this.encryptPrivateKey(agentPrivateKey);

      const agentKey: ServerAgentKey = {
        keyId,
        userAddress,
        agentAddress: agentAccount.address,
        smartWalletAddress,
        encryptedPrivateKey,
        provider: metadata.provider,
        createdAt: metadata.createdAt || Date.now(),
        isActive: true,
      };

      // Store in Redis
      await getRedisClient().set(
        REDIS_KEYS.AGENT_KEY(keyId),
        JSON.stringify(agentKey),
      );
      await getRedisClient().sadd(
        REDIS_KEYS.USER_AGENT_KEYS(userAddress),
        keyId,
      );
      await getRedisClient().set(
        REDIS_KEYS.AGENT_KEY_BY_WALLET(smartWalletAddress),
        keyId,
      );

      console.log(`✅ Stored ${metadata.provider} agent key: ${keyId}`);
      console.log(`   Agent address: ${agentAccount.address}`);
      console.log(`   Smart wallet: ${smartWalletAddress}`);

      return agentKey;
    } catch (error) {
      console.error('❌ Failed to store agent key:', error);
      throw error;
    }
  }

  /**
   * Clean up expired or unused keys
   */
  async cleanupOldKeys(daysUnused = 90): Promise<number> {
    const cutoffTime = Date.now() - daysUnused * 24 * 60 * 60 * 1000;
    const cleanedCount = 0;

    // This would need to iterate through all keys in production
    // For now, just return 0
    return cleanedCount;
  }
}

// Export singleton instance
export const serverAgentKeyService = new ServerAgentKeyService();
