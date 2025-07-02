import {
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  encodeFunctionData,
  toBytes,
  toHex,
} from 'viem';
import { base, baseSepolia } from 'viem/chains';
import {
  DEFAULT_IMPLEMENTATION_ADDRESS,
  type EIP7702Authorization,
  type EIP7702DelegationInfo,
  EIP7702ProxyABI,
  type EIP7702SignatureRequest,
  EIP7702_PROXY_ADDRESS,
  INTERFACE_IDS,
  SmartWalletImplementationABI,
} from '../contracts/EIP7702';

// Re-export the type
export type { EIP7702DelegationInfo };

export class EIP7702Manager {
  private publicClient: PublicClient;
  private chain: typeof base | typeof baseSepolia;

  constructor(chainId?: number) {
    this.chain = chainId === 84532 ? baseSepolia : base;
    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(),
    });
  }

  /**
   * Check if an address is an EOA or has existing code
   */
  async isEOA(address: Address): Promise<boolean> {
    const code = await this.publicClient.getBytecode({ address });
    return !code || code === '0x';
  }

  /**
   * Check if an address has an active EIP-7702 delegation
   */
  async hasActiveDelegation(address: Address): Promise<boolean> {
    try {
      // Check if the address has delegated code
      const code = await this.publicClient.getBytecode({ address });

      // EIP-7702 delegated accounts have a specific code pattern
      // The code starts with 0xef0100 followed by the implementation address
      if (code && code.startsWith('0xef0100')) {
        return true;
      }

      // Alternative: Try to get implementation from proxy
      if (
        EIP7702_PROXY_ADDRESS &&
        EIP7702_PROXY_ADDRESS !== '0x0000000000000000000000000000000000000000'
      ) {
        const implementation = await this.publicClient.readContract({
          address: EIP7702_PROXY_ADDRESS,
          abi: EIP7702ProxyABI,
          functionName: 'getImplementation',
          args: [address],
        });

        return implementation !== '0x0000000000000000000000000000000000000000';
      }

      return false;
    } catch (error) {
      console.error('Error checking delegation status:', error);
      return false;
    }
  }

  /**
   * Get delegation info for an address
   */
  async getDelegationInfo(
    address: Address,
  ): Promise<EIP7702DelegationInfo | null> {
    try {
      const hasDelegation = await this.hasActiveDelegation(address);

      if (!hasDelegation) {
        return null;
      }

      // Get the implementation address
      let implementation: Address = DEFAULT_IMPLEMENTATION_ADDRESS;

      if (
        EIP7702_PROXY_ADDRESS &&
        EIP7702_PROXY_ADDRESS !== '0x0000000000000000000000000000000000000000'
      ) {
        try {
          implementation = (await this.publicClient.readContract({
            address: EIP7702_PROXY_ADDRESS,
            abi: EIP7702ProxyABI,
            functionName: 'getImplementation',
            args: [address],
          })) as Address;
        } catch (error) {
          console.log('Could not get implementation from proxy, using default');
        }
      }

      return {
        isActive: true,
        implementation,
        chainId: BigInt(this.chain.id),
      };
    } catch (error) {
      console.error('Error getting delegation info:', error);
      return null;
    }
  }

  /**
   * Generate EIP-7702 authorization signature request
   */
  async generateAuthorizationRequest(
    userAddress: Address,
    delegateAddress: Address = DEFAULT_IMPLEMENTATION_ADDRESS,
  ): Promise<EIP7702SignatureRequest> {
    // Get current nonce for the account
    let nonce = BigInt(0);

    try {
      // Try to get nonce from the account
      const transactionCount = await this.publicClient.getTransactionCount({
        address: userAddress,
      });
      nonce = BigInt(transactionCount);
    } catch (error) {
      console.error('Error getting nonce:', error);
    }

    return {
      chainId: BigInt(this.chain.id),
      delegateAddress,
      nonce,
      expiry: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour expiry
    };
  }

  /**
   * Create the authorization message to be signed
   */
  createAuthorizationMessage(request: EIP7702SignatureRequest): string {
    return `EIP-7702 Authorization

Chain ID: ${request.chainId}
Delegate To: ${request.delegateAddress}
Nonce: ${request.nonce}
${request.expiry ? `Expires: ${new Date(Number(request.expiry) * 1000).toISOString()}` : ''}

By signing this message, you authorize your EOA to delegate its execution to the smart contract at ${request.delegateAddress}. This enables smart wallet features like gas sponsorship and batched transactions.`;
  }

  /**
   * Submit EIP-7702 delegation transaction
   */
  async submitDelegation(
    walletClient: WalletClient,
    userAddress: Address,
    authorization: EIP7702Authorization,
    implementation: Address = DEFAULT_IMPLEMENTATION_ADDRESS,
    initData: Hex = '0x',
  ): Promise<Hex> {
    try {
      // Encode the authorization for the transaction
      const authorizationList = [
        {
          chainId: Number(authorization.chainId),
          address: authorization.address,
          nonce: Number(authorization.nonce),
          v: Number(authorization.v),
          r: authorization.r,
          s: authorization.s,
        },
      ];

      // Create EIP-7702 transaction
      const hash = await walletClient.sendTransaction({
        account: userAddress,
        to: userAddress, // Self-call to activate delegation
        data: initData,
        authorizationList, // This is the key EIP-7702 field
        chain: this.chain,
      } as any); // Type assertion needed as viem types might not include authorizationList yet

      return hash;
    } catch (error) {
      console.error('Error submitting delegation:', error);
      throw new Error('Failed to submit EIP-7702 delegation');
    }
  }

  /**
   * Parse authorization from signature
   */
  parseAuthorizationFromSignature(
    signature: Hex,
    request: EIP7702SignatureRequest,
  ): EIP7702Authorization {
    // Extract v, r, s from signature
    const bytes = toBytes(signature);
    const r = toHex(bytes.slice(0, 32));
    const s = toHex(bytes.slice(32, 64));
    const v = BigInt(bytes[64] || 0);

    return {
      chainId: request.chainId,
      address: request.delegateAddress,
      nonce: request.nonce,
      v: v < 27n ? v + 27n : v, // Ensure v is in correct range
      r,
      s,
    };
  }

  /**
   * Check if implementation supports required interfaces
   */
  async checkImplementationSupport(implementation: Address): Promise<{
    supportsERC165: boolean;
    supportsERC1271: boolean;
    supportsERC4337: boolean;
    supportsSessionKeys: boolean;
  }> {
    const results = {
      supportsERC165: false,
      supportsERC1271: false,
      supportsERC4337: false,
      supportsSessionKeys: false,
    };

    try {
      // Check ERC165 support
      results.supportsERC165 = (await this.publicClient.readContract({
        address: implementation,
        abi: SmartWalletImplementationABI,
        functionName: 'supportsInterface',
        args: [INTERFACE_IDS.ERC165],
      })) as boolean;

      if (results.supportsERC165) {
        // Check other interfaces
        const [erc1271, erc4337, sessionKey] = await Promise.all([
          this.publicClient.readContract({
            address: implementation,
            abi: SmartWalletImplementationABI,
            functionName: 'supportsInterface',
            args: [INTERFACE_IDS.ERC1271],
          }),
          this.publicClient.readContract({
            address: implementation,
            abi: SmartWalletImplementationABI,
            functionName: 'supportsInterface',
            args: [INTERFACE_IDS.ERC4337],
          }),
          this.publicClient.readContract({
            address: implementation,
            abi: SmartWalletImplementationABI,
            functionName: 'supportsInterface',
            args: [INTERFACE_IDS.SESSION_KEY],
          }),
        ]);

        results.supportsERC1271 = erc1271 as boolean;
        results.supportsERC4337 = erc4337 as boolean;
        results.supportsSessionKeys = sessionKey as boolean;
      }
    } catch (error) {
      console.error('Error checking implementation support:', error);
    }

    return results;
  }

  /**
   * Execute transaction through delegated account
   */
  async executeTransaction(
    walletClient: WalletClient,
    userAddress: Address,
    to: Address,
    value = 0n,
    data: Hex = '0x',
  ): Promise<Hex> {
    // For EIP-7702 delegated accounts, transactions are sent normally
    // The delegation automatically applies the smart contract logic
    const hash = await walletClient.sendTransaction({
      account: userAddress,
      to,
      value,
      data,
      chain: this.chain,
    });

    return hash;
  }

  /**
   * Execute batch transactions through delegated account
   */
  async executeBatchTransaction(
    walletClient: WalletClient,
    userAddress: Address,
    calls: Array<{ to: Address; value: bigint; data: Hex }>,
  ): Promise<Hex> {
    // Encode batch execution call
    const batchData = encodeFunctionData({
      abi: SmartWalletImplementationABI,
      functionName: 'executeBatch',
      args: [calls],
    });

    // Send to self to trigger delegated execution
    const hash = await walletClient.sendTransaction({
      account: userAddress,
      to: userAddress,
      data: batchData,
      chain: this.chain,
    });

    return hash;
  }

  /**
   * Estimate gas for delegation activation
   */
  async estimateDelegationGas(
    userAddress: Address,
    implementation: Address = DEFAULT_IMPLEMENTATION_ADDRESS,
    initData: Hex = '0x',
  ): Promise<bigint> {
    try {
      const gas = await this.publicClient.estimateGas({
        account: userAddress,
        to: userAddress,
        data: initData,
        // Note: authorizationList would be included in actual transaction
      });

      // Add buffer for authorization processing
      return gas + 50000n;
    } catch (error) {
      console.error('Error estimating gas:', error);
      // Return reasonable default
      return 200000n;
    }
  }
}

// Export singleton instance
export const eip7702Manager = new EIP7702Manager();
