'use client';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { http, createPublicClient } from 'viem';
import type { Address } from 'viem';
import { base } from 'viem/chains';
import { useAccount, useSignMessage, useWalletClient } from 'wagmi';
import {
  type EIP7702DelegationInfo,
  eip7702Manager,
} from '../services/eip7702Manager';

interface SessionKey {
  keyAddress: Address;
  permissions: {
    target: Address;
    valueLimit: bigint;
    selector: string;
    rules: string[];
  }[];
  validUntil: number;
  validAfter: number;
}

interface WalletInfo {
  address: Address;
  isSmartContract: boolean;
  hasSessionKeySupport: boolean;
  walletType:
    | 'EOA'
    | 'SMART_CONTRACT'
    | 'COINBASE_SMART_WALLET'
    | 'EIP7702_DELEGATED';
  capabilities: string[];
  eip7702Delegation?: EIP7702DelegationInfo;
  needsUpgrade?: boolean;
}

export function useSmartWallet() {
  const {
    ready,
    authenticated,
    user,
    signMessage: privySignMessage,
  } = usePrivy();
  const { wallets } = useWallets();
  const { address: wagmiAddress, isConnected } = useAccount();
  const { data: walletClient, isLoading: isWalletClientLoading } =
    useWalletClient();
  const { signMessageAsync } = useSignMessage();
  const [sessionKeys, setSessionKeys] = useState<SessionKey[]>([]);
  const [isLoadingSessionKeys, setIsLoadingSessionKeys] = useState(false);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [isDetectingWallet, setIsDetectingWallet] = useState(false);
  const [lastDetectedAddress, setLastDetectedAddress] =
    useState<Address | null>(null);
  const [smartWalletAddress, setSmartWalletAddress] = useState<Address | null>(
    null,
  );

  // Get the user's wallet (embedded wallet in production, regular wallet in development)
  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === 'privy',
  );
  // Fallback to any available wallet in development
  const anyWallet = wallets.length > 0 ? wallets[0] : null;
  const activeWallet = embeddedWallet || anyWallet;

  // Check for smart wallet address in localStorage
  useEffect(() => {
    if (embeddedWallet && !smartWalletAddress) {
      // Check all possible localStorage keys
      const storedSmartWallet =
        localStorage.getItem(`smartWallet_${embeddedWallet.address}`) ||
        localStorage.getItem(`manualSmartWallet_${embeddedWallet.address}`) ||
        localStorage.getItem(`realSmartWallet_${embeddedWallet.address}`);
      if (storedSmartWallet) {
        setSmartWalletAddress(storedSmartWallet as Address);
      }
    }
  }, [embeddedWallet, smartWalletAddress]);

  // Use smart wallet address if available, otherwise use embedded wallet
  const address =
    smartWalletAddress ||
    (activeWallet?.address as Address | undefined) ||
    (wagmiAddress as Address);

  // Debug logging to check wallet details
  useEffect(() => {
    if (wallets.length > 0) {
      console.log('=== WALLET DETECTION DEBUG ===');
      console.log(
        'Available wallets:',
        wallets.map((w) => ({
          address: w.address,
          walletClientType: w.walletClientType,
          connectorType: w.connectorType,
          imported: w.imported,
          chainId: w.chainId,
        })),
      );
      console.log(
        'Embedded wallet found:',
        embeddedWallet
          ? {
              address: embeddedWallet.address,
              walletClientType: embeddedWallet.walletClientType,
              connectorType: embeddedWallet.connectorType,
            }
          : 'None',
      );
      console.log('Wagmi address:', wagmiAddress);
      console.log('Active wallet details:', {
        address: activeWallet?.address,
        walletClientType: activeWallet?.walletClientType,
        connectorType: activeWallet?.connectorType,
        imported: activeWallet?.imported,
        isEmbedded: activeWallet?.walletClientType === 'privy',
      });
      console.log('Final address being used:', address);
      console.log('=== END WALLET DEBUG ===');
    }
  }, [wallets, activeWallet, embeddedWallet, wagmiAddress, address]);

  // Create public client for wallet detection (memoized to prevent infinite re-renders)
  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: base,
        transport: http(),
      }),
    [],
  );

  // Detect wallet type and capabilities
  const detectWalletInfo = useCallback(
    async (walletAddress: Address): Promise<WalletInfo> => {
      try {
        setIsDetectingWallet(true);

        // PRIORITY 1: Check for EIP-7702 delegation first
        const hasActiveDelegation =
          await eip7702Manager.hasActiveDelegation(walletAddress);
        let eip7702Delegation: EIP7702DelegationInfo | undefined;

        if (hasActiveDelegation) {
          eip7702Delegation =
            (await eip7702Manager.getDelegationInfo(walletAddress)) ||
            undefined;

          const info: WalletInfo = {
            address: walletAddress,
            isSmartContract: true, // EIP-7702 delegated accounts act as smart contracts
            hasSessionKeySupport: true,
            walletType: 'EIP7702_DELEGATED',
            capabilities: [
              'EIP-7702',
              'SMART_WALLET',
              'SESSION_KEYS',
              'GAS_SPONSORSHIP',
              'BATCH_TRANSACTIONS',
            ],
            eip7702Delegation,
            needsUpgrade: false,
          };
          setWalletInfo(info);
          setLastDetectedAddress(walletAddress);
          return info;
        }

        // Check if we have a deployed smart wallet for this embedded wallet
        const isPrivyEmbedded = activeWallet?.walletClientType === 'privy';
        const hasSmartWallet =
          smartWalletAddress && smartWalletAddress === walletAddress;

        if (isPrivyEmbedded || hasSmartWallet) {
          const info: WalletInfo = {
            address: walletAddress,
            isSmartContract: hasSmartWallet || false, // True if smart wallet deployed
            hasSessionKeySupport: hasSmartWallet || false,
            walletType: hasSmartWallet ? 'COINBASE_SMART_WALLET' : 'EOA',
            capabilities: hasSmartWallet
              ? ['ERC-4337', 'SESSION_KEYS', 'GAS_SPONSORSHIP', 'SMART_WALLET']
              : [
                  'EOA',
                  'PRIVY_EMBEDDED',
                  'SMART_WALLET_READY', // Can deploy smart wallet
                  'EIP7702_UPGRADEABLE', // Can be upgraded with EIP-7702
                ],
            needsUpgrade: !hasSmartWallet, // Show upgrade option if no smart wallet deployed
          };
          setWalletInfo(info);
          setLastDetectedAddress(walletAddress);
          return info;
        }

        // Check if address has contract code
        const code = await publicClient.getBytecode({ address: walletAddress });
        const isSmartContract = !!code && code !== '0x';

        let walletType: WalletInfo['walletType'] = 'EOA';
        let hasSessionKeySupport = false;
        const capabilities: string[] = [];

        if (isSmartContract) {
          walletType = 'SMART_CONTRACT';

          // Check for Coinbase Smart Wallet by looking at wallet client type
          if (
            activeWallet?.walletClientType === 'coinbase_smart_wallet' ||
            activeWallet?.walletClientType === 'coinbase_wallet'
          ) {
            walletType = 'COINBASE_SMART_WALLET';
            hasSessionKeySupport = true;
            capabilities.push('ERC-4337', 'SESSION_KEYS', 'GAS_SPONSORSHIP');
          } else {
            // Generic smart contract wallet
            capabilities.push('SMART_CONTRACT');
          }
        } else {
          // EOA wallet
          capabilities.push('EOA', 'DIRECT_SIGNING', 'EIP7702_UPGRADEABLE');

          // Check if it's connected via Coinbase Wallet (which can create smart wallets)
          if (activeWallet?.walletClientType === 'coinbase_wallet') {
            capabilities.push('COINBASE_WALLET_UPGRADE_AVAILABLE');
          }
        }

        const info: WalletInfo = {
          address: walletAddress,
          isSmartContract,
          hasSessionKeySupport,
          walletType,
          capabilities,
          needsUpgrade: !isSmartContract, // EOAs can be upgraded with EIP-7702
        };

        setWalletInfo(info);
        setLastDetectedAddress(walletAddress);
        return info;
      } catch (error) {
        console.error('Failed to detect wallet info:', error);
        // Default to EOA if detection fails
        const defaultInfo: WalletInfo = {
          address: walletAddress,
          isSmartContract: false,
          hasSessionKeySupport: false,
          walletType: 'EOA',
          capabilities: ['EOA'],
        };
        setWalletInfo(defaultInfo);
        setLastDetectedAddress(walletAddress);
        return defaultInfo;
      } finally {
        setIsDetectingWallet(false);
      }
    },
    [activeWallet, publicClient, smartWalletAddress],
  );

  // Auto-detect wallet info when address changes
  useEffect(() => {
    if (address && ready && authenticated && lastDetectedAddress !== address) {
      detectWalletInfo(address);
    }
  }, [address, ready, authenticated, lastDetectedAddress, detectWalletInfo]);

  // Generate a session key for DCA automation with wallet approval
  const generateSessionKey = useCallback(
    async (
      targetContract: Address,
      permissions: {
        valueLimit?: bigint;
        functionSelectors?: string[];
        validDuration?: number;
      } = {},
    ) => {
      if (
        !(activeWallet && ready && authenticated) &&
        !(isConnected && wagmiAddress)
      ) {
        throw new Error('Wallet not available');
      }

      const {
        valueLimit = BigInt(0),
        functionSelectors = ['0xa9059cbb'], // ERC20 transfer by default
        validDuration = 60 * 24 * 60 * 60, // 60 days in seconds
      } = permissions;

      const validAfter = Math.floor(Date.now() / 1000);
      const validUntil = validAfter + validDuration;

      // Base chain ID constant
      const BASE_CHAIN_ID = 8453;

      try {
        // Request wallet signature for session key authorization
        // Format the value limit properly (USDC has 6 decimals)
        const formattedValueLimit = (Number(valueLimit) / 1e6).toFixed(6);
        // Create a simple message first to test signing
        const message = `Approve DCA automation session key for ${formattedValueLimit} USDC. Contract: ${targetContract}. Valid until: ${new Date(validUntil * 1000).toLocaleString()}. This allows automated DCA swaps on your behalf.`;

        console.log('=== SESSION KEY SIGNING DEBUG ===');
        console.log('Message to sign:', {
          message,
          length: message.length,
          isEmpty: !message || message.trim().length === 0,
        });

        // Validate message is not empty
        if (!message || message.trim().length === 0) {
          throw new Error('Message is empty or invalid');
        }

        // CRITICAL: Ensure wallet is on Base chain BEFORE any other logic
        console.log('=== CHAIN VALIDATION START ===');
        if (!activeWallet) {
          console.log('activeWallet is null/undefined - cannot proceed');
          throw new Error('No active wallet available for signing');
        }

        console.log('Active wallet for signing:', {
          address: activeWallet?.address,
          walletClientType: activeWallet?.walletClientType,
          connectorType: activeWallet?.connectorType,
          isPrivyEmbedded: activeWallet?.walletClientType === 'privy',
          chainId: activeWallet?.chainId,
        });

        console.log('activeWallet exists, checking chain...');
        console.log('Current wallet chain ID:', activeWallet.chainId);
        // Handle both formats: "eip155:8453" and just "8453"
        const currentChainId =
          typeof activeWallet.chainId === 'string' &&
          activeWallet.chainId.includes(':')
            ? Number.parseInt(activeWallet.chainId.split(':')[1])
            : Number(activeWallet.chainId);

        console.log(
          'Parsed chain ID:',
          currentChainId,
          'Expected:',
          BASE_CHAIN_ID,
        );

        if (currentChainId !== BASE_CHAIN_ID) {
          console.log(
            `Switching chain from ${activeWallet.chainId} to Base (${BASE_CHAIN_ID})...`,
          );
          try {
            await activeWallet.switchChain(BASE_CHAIN_ID);
            // Wait for chain switch to complete
            await new Promise((resolve) => setTimeout(resolve, 2000));
            console.log('Successfully switched to Base chain');

            // Verify the switch worked
            console.log('New chain ID after switch:', activeWallet.chainId);
          } catch (error) {
            console.error('Failed to switch chain:', error);
            throw new Error(
              'Please manually switch to Base network to continue',
            );
          }
        } else {
          console.log('Already on Base chain, proceeding...');
          // Force refresh the chain context to ensure signing uses correct chain
          console.log('Forcing chain context refresh...');
          try {
            await activeWallet.switchChain(BASE_CHAIN_ID);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            console.log('Chain context refreshed successfully');
          } catch (error) {
            console.log(
              'Chain context refresh failed (may be expected):',
              error,
            );
            // Continue anyway since wallet reports correct chain
          }
        }
        console.log('=== CHAIN VALIDATION END ===');

        console.log('Current address context:', address);
        console.log('Wagmi address context:', wagmiAddress);

        let currentWalletClient = null;

        // Skip trying to get wallet client for Privy wallets - we'll use direct signing
        if (activeWallet?.walletClientType === 'privy') {
          console.log('Privy wallet detected, will use direct signing method');
          currentWalletClient = null;
        } else {
          // For other wallets, use wagmi wallet client
          if (isWalletClientLoading) {
            console.log('Wallet client is loading, waiting...');
            // Wait a bit for wallet client to load
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
          currentWalletClient = walletClient;
        }

        // Try different signing methods
        let signature: string;

        if (currentWalletClient) {
          console.log('Using wallet client to sign...');
          signature = await currentWalletClient.signMessage({
            message,
            account: address,
          });
        } else if (activeWallet?.walletClientType === 'privy') {
          // For Privy embedded wallets, use the wallet's direct signing method
          console.log('Using Privy embedded wallet direct signing...');

          // Final chain verification before signing
          console.log('=== PRE-SIGNING CHAIN CHECK ===');
          console.log(
            'Final chain check before signing:',
            activeWallet.chainId,
          );
          const finalChainId =
            typeof activeWallet.chainId === 'string' &&
            activeWallet.chainId.includes(':')
              ? Number.parseInt(activeWallet.chainId.split(':')[1])
              : Number(activeWallet.chainId);
          console.log('Final parsed chain ID:', finalChainId);

          try {
            console.log('Attempting Privy embedded wallet direct signing...');
            console.log('Message to sign:', JSON.stringify(message));

            // For Privy embedded wallets, try different signing approaches
            console.log('Available signing methods:', {
              privySignMessage: !!privySignMessage,
              activeWalletSignMessage: !!activeWallet.signMessage,
              activeWalletType: typeof activeWallet.signMessage,
            });

            // Method 1: Try direct wallet signing first
            if (
              activeWallet.signMessage &&
              typeof activeWallet.signMessage === 'function'
            ) {
              console.log('Using activeWallet.signMessage method...');
              try {
                signature = await activeWallet.signMessage(message);
                console.log(
                  'Successfully signed with activeWallet.signMessage',
                );
              } catch (walletError) {
                console.error('activeWallet.signMessage failed:', walletError);
                throw walletError;
              }
            } else if (privySignMessage) {
              console.log('Using Privy signMessage hook...');
              // Ensure we're on the correct chain before signing
              if (finalChainId !== BASE_CHAIN_ID) {
                console.log('Chain mismatch detected, forcing chain switch...');
                await activeWallet.switchChain(BASE_CHAIN_ID);
                await new Promise((resolve) => setTimeout(resolve, 2000));
              }

              // Ensure message is properly formatted for Privy
              const messageToSign =
                typeof message === 'string' ? message : JSON.stringify(message);
              console.log('Signing message:', messageToSign);
              console.log('Message type:', typeof messageToSign);
              console.log('Message length:', messageToSign.length);
              console.log('Message is truthy:', !!messageToSign);
              console.log(
                'Message trimmed length:',
                messageToSign.trim().length,
              );

              // Privy signMessage expects object format
              try {
                signature = await privySignMessage({
                  message: messageToSign,
                });
                console.log(
                  'Successfully signed with Privy signMessage hook (object format)',
                );
              } catch (objectError) {
                console.error(
                  'privySignMessage failed with object:',
                  objectError,
                );
                // Try with string format as fallback
                try {
                  signature = await privySignMessage(messageToSign);
                  console.log(
                    'Successfully signed with Privy signMessage hook (string format)',
                  );
                } catch (stringError) {
                  console.error(
                    'privySignMessage failed with string:',
                    stringError,
                  );
                  throw objectError; // Throw the original object error
                }
              }
            } else {
              throw new Error('No Privy signing method available');
            }
          } catch (privyError) {
            console.error('Privy embedded wallet signing failed:', privyError);

            // If we get a chainId error, try to force the chain context
            if (
              privyError.message?.includes('chainId') ||
              privyError.message?.includes('Unsupported chainId')
            ) {
              console.log(
                'Chain ID error detected, attempting chain context reset...',
              );
              try {
                // Force disconnect and reconnect to reset chain context
                console.log(
                  'Attempting to reset Privy wallet chain context...',
                );

                // Try switching to mainnet first, then back to Base
                await activeWallet.switchChain(1); // Mainnet
                await new Promise((resolve) => setTimeout(resolve, 1000));
                await activeWallet.switchChain(BASE_CHAIN_ID); // Back to Base
                await new Promise((resolve) => setTimeout(resolve, 2000));

                // Retry signing after chain reset
                if (privySignMessage) {
                  const messageToSign =
                    typeof message === 'string'
                      ? message
                      : JSON.stringify(message);
                  signature = await privySignMessage(messageToSign);
                } else if (activeWallet.signMessage) {
                  signature = await activeWallet.signMessage(message);
                } else {
                  throw new Error(
                    'No signing method available after chain reset',
                  );
                }
                console.log('Successfully signed after chain context reset');
              } catch (resetError) {
                console.error('Chain context reset failed:', resetError);
                throw new Error(
                  `Privy embedded wallet signing failed due to chain configuration issues. Please try disconnecting and reconnecting your wallet. Original error: ${privyError.message}`,
                );
              }
            } else {
              throw new Error(
                `Privy embedded wallet signing failed. Error: ${privyError.message}`,
              );
            }
          }
        } else if (signMessageAsync) {
          console.log('Using wagmi signMessageAsync...');
          signature = await signMessageAsync({ message });
        } else {
          console.error('No signing method available. Available options:', {
            wagmiClient: !!walletClient,
            signMessageAsync: !!signMessageAsync,
            privyWallet: !!activeWallet,
            privyWalletType: activeWallet?.walletClientType,
            isConnected,
            hasAddress: !!address,
          });
          throw new Error(
            'No signing method available - please ensure wallet is properly connected',
          );
        }

        console.log('Requesting session key approval signature...');

        console.log('Session key approved by user:', signature);

        // Create session key permissions
        const sessionKeyPermissions = functionSelectors.map((selector) => ({
          target: targetContract,
          valueLimit,
          selector,
          rules: [],
        }));

        const sessionKey: SessionKey = {
          keyAddress: address,
          permissions: sessionKeyPermissions,
          validUntil,
          validAfter,
        };

        // Store session key locally (in production, this would be stored securely)
        setSessionKeys((prev) => [...prev, sessionKey]);

        return sessionKey;
      } catch (error) {
        console.error('Session key approval failed:', error);
        throw new Error('User rejected session key approval');
      }
    },
    [activeWallet, ready, authenticated],
  );

  // Simulate transaction execution with session key
  const executeWithSessionKey = useCallback(
    async (
      sessionKey: SessionKey,
      transaction: {
        to: Address;
        data: string;
        value?: bigint;
      },
    ) => {
      if (!activeWallet || !address) {
        throw new Error('Wallet not available');
      }

      // Verify session key is valid
      const now = Math.floor(Date.now() / 1000);
      if (now < sessionKey.validAfter || now > sessionKey.validUntil) {
        throw new Error('Session key expired or not yet valid');
      }

      // Check if transaction is allowed by session key permissions
      const hasPermission = sessionKey.permissions.some(
        (permission) =>
          permission.target.toLowerCase() === transaction.to.toLowerCase() &&
          (transaction.value || BigInt(0)) <= permission.valueLimit,
      );

      if (!hasPermission) {
        throw new Error('Transaction not permitted by session key');
      }

      // In a real implementation, this would execute via the smart wallet
      // For now, return a mock transaction hash
      const mockHash = `0x${Math.random().toString(16).substring(2)}`;
      console.log('Mock transaction executed:', {
        transaction,
        hash: mockHash,
      });

      return mockHash;
    },
    [activeWallet, address],
  );

  // Check if user has gas sponsorship available (only for smart wallets)
  const hasGasSponsorship = useCallback(() => {
    return (
      ready &&
      authenticated &&
      !!activeWallet &&
      walletInfo?.walletType === 'COINBASE_SMART_WALLET' &&
      walletInfo?.hasSessionKeySupport
    );
  }, [activeWallet, ready, authenticated, walletInfo]);

  // Check if current wallet is suitable for DCA automation
  const isSmartWalletReady = useCallback(() => {
    return (
      ready &&
      authenticated &&
      !!activeWallet &&
      walletInfo?.isSmartContract &&
      walletInfo?.hasSessionKeySupport
    );
  }, [activeWallet, ready, authenticated, walletInfo]);

  return {
    // Wallet state
    address,
    smartWallet: activeWallet,
    walletClient: activeWallet,
    publicClient,
    isReady: ready && authenticated && !!activeWallet,

    // Wallet information
    walletInfo,
    isDetectingWallet,
    detectWalletInfo,

    // Session key management
    sessionKeys,
    isLoadingSessionKeys,
    generateSessionKey,
    executeWithSessionKey,

    // Utilities
    hasGasSponsorship,
    isSmartWalletReady,
  };
}
