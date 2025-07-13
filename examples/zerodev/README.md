# ZeroDev Code Examples

This directory contains comprehensive code examples for ZeroDev SDK integration, including both custom EIP-7702 implementations and the complete ZeroDev examples collection.

## Quick Start Files

### 01-setup-dependencies.sh
Installation script for all required dependencies including:
- @tanstack/react-query
- wagmi
- viem
- @zerodev/ecdsa-validator
- @zerodev/sdk

### 02-kernel-account-creation.ts
Core functionality for creating a kernel account with EIP-7702 authorization:
- Kernel version setup (KERNEL_V3_3)
- Private key generation
- EIP-7702 authorization signing
- Kernel account creation

### 03-paymaster-client-setup.ts
Gas sponsorship configuration:
- Paymaster client creation
- Kernel account client setup
- Integration with bundler and paymaster RPCs

### 04-transaction-batching.ts
Transaction batching capabilities:
- Multiple transaction calls in single user operation
- Function data encoding
- Batch execution examples

### 05-complete-integration.ts
Full integration example combining all components:
- Complete EIP7702Integration class
- Initialization workflow
- Transaction execution methods
- Batch transfer functionality

### privy-7702-integration-examples.md
Comprehensive guide for integrating Privy with ZeroDev:
- Provider configuration
- Kernel account creation hooks
- Transaction execution components
- Gas sponsorship and permission management

## Complete Examples Collection (zerodev-examples-main/)

### 🏗️ Account Management
- **create-account/**: Basic smart account creation and simple transactions
- **create-ecdsa-migration-account/**: Account creation with migration capabilities
- **emit-event-when-creating-account/**: Custom events during account setup
- **change-sudo-validator/**: Dynamic validator management

### 📦 Transaction Batching
- **batch-transactions/**: Multiple transaction bundling
  - `batch-txns.ts`: Transaction batching using `sendTransaction`
  - `batch-userops.ts`: User operation batching
  - **v1/**: Legacy batch implementations

### 🔐 Session Keys & Permissions
- **session-keys/**: Comprehensive session key management
  - `1-click-trading.ts`: Complete session key workflow
  - `transaction-automation.ts`: Advanced automation with session keys
  - `install-permissions-with-init-config.ts`: Permission installation
  - `revoke-session-key-with-session-key.ts`: Session key revocation
  - **7702/**: EIP-7702 specific session key implementations
  - **v2-old/**: Legacy session key examples

### 🌐 Multi-Chain Operations
- **multi-chain/**: Cross-chain transaction coordination
  - `main.ts`: Multi-chain user operation coordination
  - `sendUserOpsWithEnable.ts`: Cross-chain capability enabling
  - `useSessionKeyWithApproval.ts`: Multi-chain session keys
  - Supports Sepolia and Optimism Sepolia

### 💰 Gas Payment Options
- **pay-gas-with-erc20/**: Alternative gas payment methods
  - `main.ts`: Pay gas with ERC20 tokens (USDC)
  - `estimate-gas.ts`: Gas estimation for ERC20 payments
  - **v1/**: Legacy ERC20 gas payment examples

### 👥 Multi-Signature Support
- **multisig/**: Multi-signature wallet functionality
  - `main.ts`: Weighted multi-signature with thresholds
  - `with-session-key.ts`: Multisig combined with session keys
  - Configurable signer weights and thresholds

### 🎯 Intent-Based Transactions
- **intent/**: Cross-chain intent execution
  - `main.ts`: Default gas payment with input tokens
  - `native.ts`: Gas payment with native tokens (ETH)
  - `sponsored.ts`: Developer-sponsored gas payments
  - `enableIntent.ts`: Kernel upgrade and intent executor setup
  - `migrateToIntentExecutor.ts`: Migration utilities
  - `estimateFee.ts`: Fee estimation for intents

### 🪝 Transaction Hooks
- **hooks/**: Transaction validation and spending limits
  - `spendingLimit.ts`: ERC20 spending limit enforcement
  - `Test_ERC20abi.ts`: ABI definitions for testing
  - Pre-transaction validation hooks

### 🔄 Account Recovery
- **guardians/**: Account recovery mechanisms
  - `recovery.ts`: Guardian-based account recovery
  - `recovery_call.ts`: Recovery through function calls
  - Weighted guardian validators

### 🔗 EIP-7702 Support
- **7702/**: EIP-7702 EOA delegation examples
  - `7702.ts`: Basic EIP-7702 account delegation
  - `7702_7821.ts`: Combined EIP-7702 and EIP-7821 support
  - **abi/**: Required ABI definitions

### 📄 Contract Deployment
- **deploy-contract/**: Smart contract deployment
  - `main.ts`: Contract deployment using `encodeDeployCallData`
  - `Greeter.ts`: Sample contract for deployment

### 📨 Transaction Sending
- **send-transactions/**: Various transaction sending methods
  - `send-txn.ts`: Direct transaction sending
  - `send-userop.ts`: User operation sending
  - `with-2d-nonce.ts`: Advanced nonce management

### 🔑 Remote Signing
- **remote-signer/**: Remote key management and signing
  - `main.ts`: Remote signer creation and usage
  - ZeroDev API key integration
  - Cloud-based key management

### ✅ Signature Validation
- **validate-signature/**: Message signing and verification
  - `validate-signature.ts`: EIP-6492 signature validation
  - Message signing with smart accounts

### 🛡️ Infrastructure & Reliability
- **fallback-clients/**: Provider redundancy and failover
  - `main.ts`: Multiple provider fallback support
  - Pimlico and Alchemy provider integration

### 📚 Tutorial & Learning
- **tutorial/**: Step-by-step learning materials
  - `template.ts`: Starting template for development
  - `completed.ts`: Full tutorial implementation
  - Comprehensive NFT minting example

## Usage

1. Run the setup script to install dependencies:
   ```bash
   chmod +x 01-setup-dependencies.sh
   ./01-setup-dependencies.sh
   ```

2. Import and use the modules in your project:
   ```typescript
   import { EIP7702Integration } from './05-complete-integration';
   
   const integration = new EIP7702Integration(
     paymasterRpc,
     bundlerRpc,
     publicClient
   );
   await integration.initialize(account, entryPoint);
   ```

3. Explore specific examples:
   ```typescript
   // Basic account creation
   import './zerodev-examples-main/create-account/main.ts';
   
   // Session key management
   import './zerodev-examples-main/session-keys/1-click-trading.ts';
   
   // Multi-chain operations
   import './zerodev-examples-main/multi-chain/main.ts';
   ```

## Key Features

- **EIP-7702 Support**: Native support for EIP-7702 account abstraction
- **Gas Sponsorship**: Integrated paymaster for gasless transactions
- **Transaction Batching**: Multiple operations in single user operation
- **Session Keys**: Delegated signing with policy-based permissions
- **Multi-Chain**: Cross-chain operation coordination
- **Multi-Signature**: Weighted threshold signatures
- **Intent Execution**: Cross-chain intent-based transactions
- **Account Recovery**: Guardian-based recovery mechanisms
- **Remote Signing**: Cloud-based key management
- **Type Safety**: Full TypeScript support with proper typing
- **Modular Design**: Clean separation of concerns across files

## Environment Setup

Create a `.env` file with the following variables:
```bash
ZERODEV_RPC=your_zerodev_rpc_url
PRIVATE_KEY=your_private_key
ZERODEV_API_KEY=your_api_key_for_advanced_features
```

## Dependencies

### Core Dependencies
- **@zerodev/sdk**: Core SDK functionality
- **@zerodev/ecdsa-validator**: ECDSA validation
- **@zerodev/permissions**: Permission management
- **@zerodev/session-key**: Session key functionality
- **@zerodev/multi-chain-ecdsa-validator**: Multi-chain support
- **@zerodev/intent**: Intent-based transactions
- **@zerodev/hooks**: Transaction hooks
- **@zerodev/weighted-validator**: Multi-signature support
- **@zerodev/remote-signer**: Remote signing capabilities
- **viem**: Ethereum client library

See `01-setup-dependencies.sh` and `zerodev-examples-main/package.json` for complete dependency lists.

## Supported Networks

- **Sepolia**: Primary testnet for examples
- **Optimism Sepolia**: Multi-chain operations
- **Base**: Intent-based cross-chain transfers
- **Ethereum Mainnet**: Production deployments (with appropriate configuration)

## Resources

- [ZeroDev Documentation](https://docs.zerodev.app/)
- [7702 ZeroDev Documentation](https://7702.zerodev.app/)
- [Privy Documentation](https://docs.privy.io/)
- [ZeroDev Dashboard](https://dashboard.zerodev.app)
- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
- [EIP-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)