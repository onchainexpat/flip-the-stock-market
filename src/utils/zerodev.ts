'use client';

import { 
  createPublicClient, 
  http, 
  type Chain, 
  type Address,
  type PublicClient
} from 'viem';
import { base, baseSepolia } from 'viem/chains';
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient
} from "@zerodev/sdk";
import { KERNEL_V3_1, getEntryPoint } from "@zerodev/sdk/constants";

// Let's also try to import other kernel versions if available
let KERNEL_V3_2, KERNEL_V2_4;
try {
  const constants = require("@zerodev/sdk/constants");
  KERNEL_V3_2 = constants.KERNEL_V3_2; 
  KERNEL_V2_4 = constants.KERNEL_V2_4;
  console.log('📋 Available kernel versions:', Object.keys(constants).filter(k => k.startsWith('KERNEL_')));
} catch (e) {
  console.log('⚠️ Could not load additional kernel versions');
}
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { 
  NEXT_PUBLIC_ZERODEV_PROJECT_ID,
  NEXT_PUBLIC_ZERODEV_RPC_URL,
  NEXT_PUBLIC_BASE_BUNDLER_URL,
  NEXT_PUBLIC_BASE_PAYMASTER_URL
} from '../config';

// EntryPoint addresses - using standard ERC-4337 addresses
export const ENTRYPOINT_ADDRESS_V06 = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as const;
export const ENTRYPOINT_ADDRESS_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as const;

// Convert Privy wallet to ZeroDev-compatible signer
export const createZeroDevSigner = async (privyWallet: any) => {
  console.log('🔧 Converting Privy wallet to ZeroDev signer:', privyWallet);
  console.log('🔍 Wallet type:', privyWallet.walletClientType);
  console.log('🔍 Is embedded wallet:', privyWallet.walletClientType === 'privy');
  
  // Get ethereum provider from Privy wallet
  const provider = await privyWallet.getEthereumProvider();
  console.log('📱 Got ethereum provider:', provider);
  
  // For embedded wallets, try a simpler approach - skip network switching
  const isEmbeddedWallet = privyWallet.walletClientType === 'privy';
  
  if (!isEmbeddedWallet) {
    // For external wallets, do normal network switching
    try {
      console.log('🔄 Switching external wallet to Base network (Chain ID 8453)...');
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }], // 8453 in hex
      });
      console.log('✅ Successfully switched to Base network');
    } catch (switchError) {
      console.log('⚠️ Failed to switch network:', switchError.message);
      console.log('🔄 Attempting to add Base network...');
      
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x2105',
            chainName: 'Base',
            nativeCurrency: {
              name: 'Ethereum',
              symbol: 'ETH',
              decimals: 18,
            },
            rpcUrls: ['https://mainnet.base.org'],
            blockExplorerUrls: ['https://basescan.org'],
          }],
        });
        console.log('✅ Successfully added Base network');
      } catch (addError) {
        console.log('⚠️ Failed to add Base network:', addError.message);
      }
    }
  } else {
    console.log('📱 Embedded wallet detected - relying on Privy configuration for Base network');
  }
  
  // Create a custom account object that matches viem's LocalAccount interface
  const customAccount = {
    address: privyWallet.address as `0x${string}`,
    type: 'local' as const,
    source: 'custom' as const,
    // Add chain information to force Base network
    chain: base,
    
    // Sign message implementation
    signMessage: async ({ message }: { message: string | Uint8Array | any }) => {
      console.log('📝 Account signing message...');
      console.log('📝 Message type:', typeof message);
      console.log('📝 Message instanceof Uint8Array:', message instanceof Uint8Array);
      console.log('📝 Message value:', message);
      
      // Check if this is an embedded wallet
      const isEmbeddedWallet = privyWallet.walletClientType === 'privy';
      console.log('📝 Wallet client type:', privyWallet.walletClientType);
      console.log('📝 Is embedded wallet:', isEmbeddedWallet);
      console.log('📝 Wallet object keys:', Object.keys(privyWallet));
      console.log('📝 Wallet address:', privyWallet.address);
      
      try {
        let messageStr: string;
        
        if (typeof message === 'string') {
          messageStr = message;
        } else if (message instanceof Uint8Array) {
          // Convert Uint8Array to string properly
          messageStr = new TextDecoder().decode(message);
        } else if (ArrayBuffer.isView(message)) {
          // Handle other typed arrays
          const uint8Array = new Uint8Array(message.buffer, message.byteOffset, message.byteLength);
          messageStr = new TextDecoder().decode(uint8Array);
        } else if (message instanceof ArrayBuffer) {
          // Handle ArrayBuffer directly
          messageStr = new TextDecoder().decode(message);
        } else if (typeof message === 'object' && message !== null) {
          // Handle hex strings or objects with raw property
          if ('raw' in message) {
            messageStr = message.raw as string;
          } else if ('hex' in message) {
            messageStr = message.hex as string;
          } else {
            // Try JSON stringify as fallback
            messageStr = JSON.stringify(message);
          }
        } else {
          // Fallback - convert to string directly
          messageStr = String(message);
        }
        
        console.log('📝 Converted message to string:', messageStr);
        
        // For embedded wallets, try a completely different approach
        if (isEmbeddedWallet) {
          console.log('🔐 Using specialized embedded wallet signing...');
          
          // Try multiple approaches for embedded wallets
          const embeddedMethods = [
            {
              name: 'Direct Privy Sign',
              method: async () => {
                console.log('🔐 Trying direct Privy sign...');
                return await privyWallet.sign(messageStr);
              }
            },
            {
              name: 'Privy Sign with Chain Context',
              method: async () => {
                console.log('🔐 Trying Privy sign with explicit chain...');
                // Try signing with chain context
                return await privyWallet.sign(messageStr, { chainId: 8453 });
              }
            },
            {
              name: 'Raw Provider with No Network Check',
              method: async () => {
                console.log('🔐 Trying raw provider without network validation...');
                const rawProvider = await privyWallet.getEthereumProvider();
                return await rawProvider.request({
                  method: 'personal_sign',
                  params: [messageStr, privyWallet.address]
                });
              }
            }
          ];
          
          for (const { name, method } of embeddedMethods) {
            try {
              console.log(`🔐 Attempting: ${name}`);
              const signature = await method();
              console.log(`✅ ${name} succeeded:`, signature);
              return signature as `0x${string}`;
            } catch (error) {
              console.log(`❌ ${name} failed:`, error.message);
            }
          }
          
          console.log('❌ All embedded wallet methods failed, falling through to provider methods...');
        }
        
        // Get the ethereum provider to sign the hash directly
        const provider = await privyWallet.getEthereumProvider();
        
        // Only try network switching for external wallets
        if (!isEmbeddedWallet) {
          try {
            console.log('🔄 Ensuring Base network (Chain ID 8453) before signing...');
            await provider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x2105' }], // 8453 in hex
            });
            console.log('✅ Confirmed on Base network');
          } catch (switchError) {
            console.log('⚠️ Network switch failed, continuing anyway:', switchError.message);
          }
        } else {
          console.log('📱 Embedded wallet - skipping network switch, using Privy configuration');
        }
        
        try {
          console.log('📝 Attempting personal_sign with provider (EIP-191)...');
          // Use personal_sign for EIP-191 message signing (safer than eth_sign)
          const signature = await provider.request({
            method: 'personal_sign',
            params: [messageStr, privyWallet.address]
          });
          console.log('✅ Message signed with personal_sign:', signature);
          return signature as `0x${string}`;
        } catch (personalSignError) {
          console.log('❌ personal_sign failed:', personalSignError.message);
          console.log('📝 Trying eth_signTypedData_v4 for structured data...');
          
          try {
            // Try eth_signTypedData_v4 for EIP-712 typed data signing
            // This is the preferred method for ERC-4337 UserOperations
            const typedData = {
              domain: {
                name: 'ZeroDev',
                version: '1',
                chainId: 8453, // Base chain ID
                verifyingContract: '0x0000000000000000000000000000000000000000'
              },
              types: {
                Message: [
                  { name: 'hash', type: 'bytes32' }
                ]
              },
              primaryType: 'Message',
              message: {
                hash: messageStr
              }
            };
            
            console.log('📝 Signing with typed data:', typedData);
            const signature = await provider.request({
              method: 'eth_signTypedData_v4',
              params: [privyWallet.address, JSON.stringify(typedData)]
            });
            console.log('✅ Message signed with eth_signTypedData_v4:', signature);
            return signature as `0x${string}`;
          } catch (typedDataError) {
            console.log('❌ eth_signTypedData_v4 failed:', typedDataError.message);
            console.log('📝 Falling back to Privy sign method...');
            
            // Final fallback - Force Privy to sign on Base network
            try {
              console.log('🔄 Attempting to switch Privy wallet to Base...');
              await privyWallet.switchChain(8453); // Switch to Base chain
              console.log('✅ Privy wallet switched to Base');
              
              // Wait a moment for the chain switch to take effect
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Try signing with explicit chain context
              console.log('📝 Signing with Privy on Base network...');
              const signature = await privyWallet.sign(messageStr);
              console.log('✅ Message signed with Privy sign:', signature);
              return signature as `0x${string}`;
              
            } catch (privySignError) {
              console.log('❌ Privy sign with Base failed:', privySignError.message);
              
              // Last resort: try to force sign without network checks
              console.log('🔧 Attempting emergency signing bypass...');
              try {
                // Get the raw provider and try to force Base network context
                const rawProvider = await privyWallet.getEthereumProvider();
                
                // Try to manually set the chain context
                const signature = await rawProvider.request({
                  method: 'personal_sign',
                  params: [messageStr, privyWallet.address]
                });
                
                console.log('✅ Emergency signing successful:', signature);
                return signature as `0x${string}`;
                
              } catch (emergencyError) {
                console.error('❌ All signing methods failed:', emergencyError.message);
                throw new Error(`Unable to sign message with Privy embedded wallet. Chain switching failed. Try using an external wallet instead.`);
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ Error in signMessage:', error);
        console.error('❌ Message details:', {
          type: typeof message,
          isUint8Array: message instanceof Uint8Array,
          isArrayBuffer: message instanceof ArrayBuffer,
          constructor: message?.constructor?.name,
          message
        });
        throw error;
      }
    },
    
    // Sign transaction implementation
    signTransaction: async (transaction: any) => {
      console.log('📝 Account signing transaction...', transaction);
      // For now, we'll use the provider to sign transactions
      const signature = await provider.request({
        method: 'eth_signTransaction',
        params: [transaction]
      });
      console.log('✅ Transaction signed:', signature);
      return signature as `0x${string}`;
    },
    
    // Sign typed data implementation
    signTypedData: async ({ domain, types, primaryType, message }: any) => {
      console.log('📝 Account signing typed data...');
      try {
        const typedData = {
          domain,
          types,
          primaryType,
          message
        };
        const signature = await provider.request({
          method: 'eth_signTypedData_v4',
          params: [privyWallet.address, JSON.stringify(typedData)]
        });
        console.log('✅ Typed data signed:', signature);
        return signature as `0x${string}`;
      } catch (error) {
        console.log('⚠️ Typed data signing failed, using fallback...');
        const fallbackMessage = JSON.stringify({ domain, types, primaryType, message });
        const signature = await privyWallet.sign(fallbackMessage);
        return signature as `0x${string}`;
      }
    }
  };
  
  console.log('✅ Created custom account:', customAccount);
  console.log('🔍 Account address:', customAccount.address);
  console.log('🔍 Account type:', customAccount.type);
  return customAccount;
};

// ZeroDev configuration for Base network
export const getZeroDevConfig = (chain: Chain = base) => {
  if (!NEXT_PUBLIC_ZERODEV_PROJECT_ID) {
    throw new Error('NEXT_PUBLIC_ZERODEV_PROJECT_ID is not configured');
  }

  // Check if using example project ID (not real)
  if (NEXT_PUBLIC_ZERODEV_PROJECT_ID === '485df233-2a0d-4aee-b94a-b266be42ea55') {
    console.warn('⚠️ Using example project ID from .env.example');
    console.warn('⚠️ Create a real ZeroDev project at https://dashboard.zerodev.app/');
    console.warn('⚠️ Select Base network and add your project ID to .env.local');
  }

  // Try the original v2 format - some projects still use this
  const bundlerUrl = `https://rpc.zerodev.app/api/v2/bundler/${NEXT_PUBLIC_ZERODEV_PROJECT_ID}`;
  const paymasterUrl = `https://rpc.zerodev.app/api/v2/paymaster/${NEXT_PUBLIC_ZERODEV_PROJECT_ID}`;
  
  console.log('🔍 Using project ID:', NEXT_PUBLIC_ZERODEV_PROJECT_ID);
  console.log('🔍 Using bundler URL:', bundlerUrl);
  console.log('🔍 Using paymaster URL:', paymasterUrl);

  return {
    projectId: NEXT_PUBLIC_ZERODEV_PROJECT_ID,
    rpcUrl: NEXT_PUBLIC_ZERODEV_RPC_URL,
    bundlerUrl,
    paymasterUrl,
    chain,
    entryPoint: ENTRYPOINT_ADDRESS_V07 as any,
  };
};

// Create public client for Base network using ZeroDev RPC
export const createBasePublicClient = (): PublicClient => {
  const config = getZeroDevConfig(base);
  console.log('🔧 Creating public client with ZeroDev RPC:', config.rpcUrl);
  
  // Try creating with minimal configuration first
  const publicClient = createPublicClient({
    chain: base,
    transport: http(config.rpcUrl),
    // Add these properties that ZeroDev might expect
    pollingInterval: 1000,
    cacheTime: 1000,
  });

  console.log('✅ Public client created:', {
    chain: publicClient.chain.name,
    transport: publicClient.transport.name,
    rpcUrl: config.rpcUrl
  });

  return publicClient;
};

// Create ZeroDev paymaster client for gas sponsorship
export const createZeroDevPaymaster = (chain: Chain = base) => {
  const config = getZeroDevConfig(chain);
  
  return createZeroDevPaymasterClient({
    chain,
    transport: http(config.paymasterUrl),
  });
};

// Create ECDSA validator from signer
export const createEcdsaValidator = async (
  publicClient: any,
  signer: any
) => {
  console.log('🔍 Creating ECDSA validator with signer:', signer);
  console.log('🔍 Signer address:', signer?.address);
  console.log('🔍 Signer type:', signer?.type);
  console.log('🔍 Signer keys:', Object.keys(signer || {}));
  
  try {
    console.log('🔍 KERNEL_V3_1 constant:', KERNEL_V3_1);
    console.log('🔍 ENTRYPOINT_ADDRESS_V06:', ENTRYPOINT_ADDRESS_V06);
    console.log('🔍 ENTRYPOINT_ADDRESS_V07:', ENTRYPOINT_ADDRESS_V07);
    
    // Use the correct ZeroDev pattern with publicClient first
    // Use v0.7 entry point to match kernel account creation
    const validator = await signerToEcdsaValidator(publicClient, {
      signer,
      entryPoint: ENTRYPOINT_ADDRESS_V07,
      kernelVersion: KERNEL_V3_1,
    });
    console.log('✅ ECDSA validator created successfully:', validator);
    return validator;
  } catch (error) {
    console.error('❌ Failed to create ECDSA validator:', error);
    console.error('❌ Error details:', {
      error,
      signerType: typeof signer,
      signerAddress: signer?.address,
      signerKeys: Object.keys(signer || {})
    });
    throw error;
  }
};

// Create kernel account with ZeroDev SDK
export const createZeroDevKernelAccount = async (
  publicClient: any,
  privyWallet: any,
  chain: Chain = base
) => {
  const config = getZeroDevConfig(chain);
  let kernelAccount: any;
  
  try {
    console.log('🔧 Starting kernel account creation...');
    console.log('🔍 Privy wallet type:', privyWallet.walletClientType);
    console.log('🔍 Privy wallet address:', privyWallet.address);
    
    // Create ZeroDev-compatible signer from Privy wallet
    const signer = await createZeroDevSigner(privyWallet);
    console.log('✅ Created ZeroDev signer');
    
    // We'll create the validator with the same entry point as the kernel account
    // So we'll move this inside the loop
    
    // Create kernel account using the validator - try different combinations
    console.log('🔍 Attempting kernel account creation...');
    console.log('🔍 Entry point v0.7:', ENTRYPOINT_ADDRESS_V07);
    console.log('🔍 Entry point v0.6:', ENTRYPOINT_ADDRESS_V06);
    console.log('🔍 KERNEL_V3_1:', KERNEL_V3_1);
    console.log('🔍 KERNEL_V3_1 type:', typeof KERNEL_V3_1);
    console.log('🔍 KERNEL_V3_1 undefined?', KERNEL_V3_1 === undefined);
    
    // Check public client
    console.log('🔍 Public client:', publicClient);
    console.log('🔍 Public client chain:', publicClient?.chain);
    console.log('🔍 Public client transport:', publicClient?.transport);
    
    // Try ZeroDev's recommended approach - let them handle entry point configuration
    console.log('🔍 ZeroDev Project ID:', config.projectId);
    console.log('🔍 Network:', config.chain.name);
    console.log('🔍 Bundler URL:', config.bundlerUrl);
    console.log('🔍 Paymaster URL:', config.paymasterUrl);
    
    // Test if we can make a simple RPC call with the public client
    try {
      const blockNumber = await publicClient.getBlockNumber();
      console.log('✅ Public client working, latest block:', blockNumber);
    } catch (error) {
      console.error('❌ Public client not working:', error.message);
    }
    
    // Try a completely different approach using ZeroDev v5 recommended pattern
    console.log('🔧 Attempting ZeroDev v5 recommended approach...');
    
    try {
      // Step 1: Use ZeroDev's official entry point approach
      console.log('🔧 Creating ECDSA validator with ZeroDev official approach...');
      const entryPoint = getEntryPoint("0.7");
      const kernelVersion = KERNEL_V3_1;
      
      console.log('🔍 Entry point from getEntryPoint("0.7"):', entryPoint);
      console.log('🔍 Kernel version:', kernelVersion);
      
      const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
        signer,
        entryPoint,
        kernelVersion,
      });
      console.log('✅ ECDSA validator created successfully');
      
      // Step 2: Create kernel account with the validator
      console.log('🔧 Creating kernel account with official configuration...');
      kernelAccount = await createKernelAccount(publicClient, {
        entryPoint,
        plugins: {
          sudo: ecdsaValidator,
        },
        kernelVersion,
      });
      console.log('✅ Kernel account created with official ZeroDev approach!');
      
    } catch (autoDetectError) {
      console.log('❌ Auto-detection failed:', autoDetectError.message);
      console.log('🔄 Falling back to manual configuration...');
      
      // Fallback: Try with ZeroDev's getEntryPoint function
      const combinations = [
        { entryPoint: getEntryPoint("0.6"), kernelVersion: KERNEL_V3_1, name: 'ZeroDev v0.6 + KERNEL_V3_1' },
        { entryPoint: getEntryPoint("0.7"), kernelVersion: KERNEL_V3_1, name: 'ZeroDev v0.7 + KERNEL_V3_1' },
        // Try with different kernel versions if available
        ...(KERNEL_V3_2 ? [{ entryPoint: getEntryPoint("0.6"), kernelVersion: KERNEL_V3_2, name: 'ZeroDev v0.6 + KERNEL_V3_2' }] : []),
        ...(KERNEL_V3_2 ? [{ entryPoint: getEntryPoint("0.7"), kernelVersion: KERNEL_V3_2, name: 'ZeroDev v0.7 + KERNEL_V3_2' }] : []),
      ];
      
      const errors = [`Auto-detect: ${autoDetectError.message}`];
      
      for (const combination of combinations) {
        try {
          console.log(`🔄 Trying ${combination.name}...`);
          console.log(`🔍 Entry point:`, combination.entryPoint);
          console.log(`🔍 Kernel version:`, combination.kernelVersion);
          
          // Create validator configuration exactly like ZeroDev examples
          const validatorConfig = {
            signer,
            entryPoint: combination.entryPoint,
            kernelVersion: combination.kernelVersion
          };
          
          console.log(`🔧 Creating ECDSA validator for ${combination.name}...`);
          const ecdsaValidator = await signerToEcdsaValidator(publicClient, validatorConfig);
          console.log(`✅ ECDSA validator created for ${combination.name}`);
          
          // Create kernel account configuration exactly like ZeroDev examples
          const kernelConfig = {
            entryPoint: combination.entryPoint,
            plugins: { sudo: ecdsaValidator },
            kernelVersion: combination.kernelVersion
          };
          
          console.log(`🔧 Creating kernel account for ${combination.name}...`);
          kernelAccount = await createKernelAccount(publicClient, kernelConfig);
          console.log(`✅ Success with ${combination.name}!`);
          break;
        } catch (error) {
          console.log(`❌ ${combination.name} failed:`, error.message);
          errors.push(`${combination.name}: ${error.message}`);
        }
      }
      
      if (!kernelAccount) {
        console.error('❌ All combinations failed:', errors);
        throw new Error(`Kernel account creation failed with all combinations: ${errors.join(', ')}`);
      }
    }
    
    console.log('🎯 Kernel account created:', kernelAccount.address);
    
    console.log('🎉 Kernel account setup complete!');
    console.log('🏠 Smart wallet address:', kernelAccount.address);
    console.log('👤 Original EOA address:', privyWallet.address);
    console.log('🔐 Entry point:', config.entryPoint);
    console.log('🔢 Kernel version:', KERNEL_V3_1);
    
    return kernelAccount;
  } catch (error) {
    console.error('❌ Failed to create kernel account:', error);
    throw error;
  }
};


// Create kernel account client with gas sponsorship
export const createZeroDevKernelClient = async (
  account: any,
  chain: Chain = base
) => {
  const config = getZeroDevConfig(chain);
  
  try {
    console.log('🔧 Creating kernel account client with unified transport...');
    console.log('🔍 Account address:', account.address);
    console.log('🔍 Chain:', chain.name);
    console.log('🔍 RPC URL:', config.rpcUrl);
    
    // Try using the unified RPC URL for both bundler and paymaster
    console.log('🔧 Attempting unified transport approach...');
    const kernelClient = createKernelAccountClient({
      account,
      chain,
      // Use the unified RPC transport that handles both bundler and paymaster
      bundlerTransport: http(config.rpcUrl),
    });
    
    console.log('✅ Kernel client created with unified transport!');
    return kernelClient;
  } catch (unifiedError) {
    console.log('❌ Unified transport failed:', unifiedError.message);
    console.log('🔄 Falling back to separate bundler/paymaster...');
    
    try {
      console.log('🔧 Creating ZeroDev paymaster...');
      const paymaster = createZeroDevPaymaster(chain);
      console.log('✅ ZeroDev paymaster created');
      
      console.log('🔧 Creating kernel account client with separate transports...');
      console.log('🔍 Bundler URL:', config.bundlerUrl);
      
      const kernelClient = createKernelAccountClient({
        account,
        chain,
        bundlerTransport: http(config.bundlerUrl),
        paymaster: {
          ...paymaster,
          // Add more detailed error logging
          async sponsorUserOperation(args) {
            try {
              console.log('🔍 Sponsoring UserOperation:', {
                sender: args.userOperation.sender,
                nonce: args.userOperation.nonce,
                callDataLength: args.userOperation.callData?.length,
              });
              const result = await paymaster.sponsorUserOperation(args);
              console.log('✅ Sponsorship successful');
              return result;
            } catch (error) {
              console.error('❌ Paymaster sponsorship failed:', error);
              throw error;
            }
          }
        },
      });
      
      console.log('✅ Kernel client created with separate transports!');
      return kernelClient;
    } catch (separateError) {
      console.error('❌ Both approaches failed');
      console.error('❌ Unified transport error:', unifiedError.message);
      console.error('❌ Separate transport error:', separateError.message);
      console.error('❌ Bundler URL that failed:', config.bundlerUrl);
      console.error('❌ Paymaster URL:', config.paymasterUrl);
      throw new Error(`Failed to create kernel client. Unified: ${unifiedError.message}, Separate: ${separateError.message}`);
    }
  }
};

// EIP-7702 Authorization utilities
export const signEIP7702Authorization = async (
  signer: any,
  contractAddress: Address,
  chainId: number
) => {
  // This would be implemented based on the specific signer interface
  // For now, this is a placeholder for the EIP-7702 authorization
  return await signer.signAuthorization({
    contractAddress,
    chainId,
    nonce: 0, // This should be fetched from the network
  });
};

// Get supported chains for ZeroDev
export const getSupportedChains = (): Chain[] => {
  return [base, baseSepolia];
};

// Check if chain is supported
export const isChainSupported = (chainId: number): boolean => {
  const supportedChains = getSupportedChains();
  return supportedChains.some(chain => chain.id === chainId);
};