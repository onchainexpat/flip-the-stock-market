# Product Requirements Plan: OpenOcean DCA Migration

## Executive Summary

This PRP outlines the migration from the current custom DCA implementation to OpenOcean's native DCA API. After reviewing the official API documentation, the integration remains challenging due to the requirement for proprietary frontend SDK signatures, though the API structure itself is now clearer.

**Current Status**: The codebase already uses a custom DCA solution with OpenOcean for swap routing only.
**Updated Recommendation**: Integration is technically feasible but still requires obtaining the frontend SDK for signature generation. The effort-to-benefit ratio remains questionable.

## Context and Research Findings

### Current Implementation Analysis

The existing DCA system is a sophisticated custom implementation that:

1. **Uses OpenOcean for swap routing only** (`/src/utils/openOceanApi.ts`)
2. **Custom DCA orchestration** with:
   - ZeroDev smart wallets (KERNEL_V3_2)
   - Redis/Upstash for order storage
   - Cron jobs for execution timing
   - Agent keys for automated execution
   - Gas sponsorship via paymaster

3. **Key files**:
   - `/src/services/simpleDCAService.ts` - Core DCA service
   - `/src/app/api/cron/execute-dca-v2/route.ts` - Automated execution
   - `/src/lib/serverDcaDatabase.ts` - Order management
   - `/src/components/DCA/SimpleDCAv2.tsx` - User interface

### OpenOcean DCA API Research

Based on official API documentation and code analysis:

1. **API Endpoints**:
   ```
   Base URL: https://open-api.openocean.finance
   - Create Order: POST /v1/:chainId/dca/swap
   - Cancel Order: POST /v1/:chainId/dca/cancel
   - List Orders by Address: GET /v1/:chainId/dca/address/:address
   - List All Orders: GET /v1/:chainId/dca/all
   ```

2. **Key API Features**:
   - Supports chains: Base (8453), Ethereum (146), Blast (80094)
   - Minimum amounts: $30 for Ethereum, $5 for other chains
   - Time interval: Minimum 60 seconds
   - Platform fees: 0-5% with referrer system (OpenOcean takes 20% of platform fee)
   - Version: v2 recommended for new integrations
   - Order statuses: 1-unfill, 3-cancel, 4-filled, 5-pending, 6-hash not exist, 7-expire

3. **SDK Availability - GAME CHANGER**:
   - **Public SDK Available**: `@openocean.finance/limitorder-sdk` on npm
   - **DCA Support**: SDK supports DCA mode with `mode: 'Dca'` parameter
   - **Signature Generation**: SDK handles all EIP-712 signatures automatically
   - **Full Documentation**: Complete examples for Web3.js and Ethers.js integration
   - Contract: `0x6cBB2598881940D08d5Ea3fA8F557E02996e1031` (Base DCA V2)

4. **SDK Features**:
   - Supports both browser wallets and private key wallets
   - Compatible with Web3.js and Ethers.js (v5 and v6)
   - Handles order creation, cancellation, and signature generation
   - Provides chart visualization capabilities
   - Full TypeScript support

### Documentation Resources

- ZeroDev Documentation: https://docs.zerodev.app/
- OpenOcean API: https://apis.openocean.finance/
- OpenOcean SDK: https://www.npmjs.com/package/@openocean.finance/limitorder-sdk
- SDK GitHub: https://github.com/openocean-finance/OpenOcean-limit-order
- Privy API: https://docs.privy.io/api-reference/introduction

## Implementation Blueprint

### Approach 1: Full OpenOcean DCA Migration (Now Feasible!)

```typescript
// Real implementation with publicly available SDK
import { openoceanLimitOrderSdk, WalletParams } from '@openocean.finance/limitorder-sdk';
import { ethers } from 'ethers';
import axios from 'axios';

class OpenOceanDCAService {
  private provider: ethers.BrowserProvider;
  private signer: ethers.Signer;
  private walletParams: WalletParams;

  // Step 1: Initialize with the public SDK
  async initialize(provider: ethers.BrowserProvider) {
    this.provider = provider;
    this.signer = await provider.getSigner();
    const address = await this.signer.getAddress();
    
    this.walletParams = {
      provider: this.provider,
      signer: this.signer,
      account: address,
      chainId: 8453,
      chainKey: 'base',
      mode: 'Dca' // Critical: enables DCA mode
    };
  }

  // Step 2: Create DCA order with SDK handling signatures
  async createDCAOrder(params: {
    makerAsset: string; // USDC address
    takerAsset: string; // SPX6900 address
    makerAmount: string; // Total amount with decimals
    time: number; // Interval in seconds (min 60)
    times: number; // Number of executions
    minPrice?: string; // Optional price range
    maxPrice?: string; // Optional price range
  }) {
    // SDK generates all required data including signatures
    const orderData = await openoceanLimitOrderSdk.createLimitOrder(
      this.walletParams,
      {
        makerTokenAddress: params.makerAsset,
        makerTokenDecimals: 6, // USDC
        takerTokenAddress: params.takerAsset,
        takerTokenDecimals: 18, // SPX6900
        makerAmount: params.makerAmount,
        takerAmount: "1", // Default, will be calculated by OpenOcean
        gasPrice: await this.getGasPrice(),
        expire: '6Month' // or dynamic based on times * time
      }
    );

    // Combine SDK data with DCA-specific parameters
    const dcaOrder = {
      ...orderData, // Contains signature, orderHash, data object, etc.
      expireTime: params.time * params.times,
      time: params.time,
      times: params.times,
      version: 'v2',
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      referrer: "0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7", // SPX platform fee address
      referrerFee: "1" // 1% platform fee
    };

    // Submit to OpenOcean DCA API
    const response = await axios.post(
      'https://open-api.openocean.finance/v1/8453/dca/swap',
      dcaOrder,
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    return response.data;
  }

  // Step 3: Cancel order with SDK support
  async cancelOrder(orderHash: string, orderData?: any) {
    // Try API cancellation first
    const { data } = await axios.post(
      'https://open-api.openocean.finance/v1/8453/dca/cancel',
      { orderHash }
    );
    
    // If needed, perform on-chain cancellation
    if (orderData && data?.data?.status && ![3, 4].includes(data.data.status)) {
      await openoceanLimitOrderSdk.cancelLimitOrder(
        this.walletParams,
        { orderData: orderData, gasPrice: await this.getGasPrice() }
      );
    }
  }

  private async getGasPrice() {
    const feeData = await this.provider.getFeeData();
    return (Number(feeData.gasPrice) * 1.2).toString();
  }
}
```

### Approach 2: Hybrid Implementation (Recommended)

Keep the current custom implementation but enhance it:

```typescript
// Enhanced custom DCA with better OpenOcean integration
class EnhancedDCAService {
  // Use OpenOcean for advanced routing
  async executeSwap(order: DCAOrder) {
    // Get optimal route from OpenOcean
    const quote = await openOceanApi.getQuote({
      inTokenAddress: order.inputToken,
      outTokenAddress: order.outputToken,
      amount: order.amount,
      gasPrice: await getGasPrice(),
      slippage: 1 // 1% slippage
    });

    // Execute via smart wallet
    return smartWalletService.executeBatch([
      approveTransaction,
      swapTransaction,
      transferTransaction
    ]);
  }
}
```

## Implementation Tasks

### If proceeding with full migration:

1. **SDK Installation Phase** (Straightforward)
   - [ ] Install SDK: `npm i @openocean.finance/limitorder-sdk`
   - [ ] Verify compatibility with existing dependencies
   - [ ] Set up TypeScript types
   - [ ] Test SDK in development environment

2. **Provider Integration Phase** (High Priority)
   - [ ] Update wallet connection to support both Ethers and Web3.js
   - [ ] Create WalletParams configuration with `mode: 'Dca'`
   - [ ] Test SDK with existing wallet providers
   - [ ] Implement gas price estimation

3. **Service Implementation** (High Priority)
   - [ ] Create `OpenOceanDCAService` class
   - [ ] Implement order creation with v2 API
   - [ ] Add order monitoring and status tracking
   - [ ] Implement order cancellation
   - [ ] Add platform fee configuration (referrer system)

4. **Database Updates** (High Priority)
   - [ ] Update order schema for OpenOcean fields
   - [ ] Add mapping between internal and OpenOcean order IDs
   - [ ] Implement order status synchronization
   - [ ] Create backup mechanism for order data

5. **API Routes** (High Priority)
   - [ ] Update `/api/dca-orders-v2` to use OpenOcean
   - [ ] Remove custom execution cron jobs
   - [ ] Add webhook endpoints for order updates
   - [ ] Implement order status polling

6. **UI Updates** (Medium Priority)
   - [ ] Update SimpleDCAv2.tsx for OpenOcean order flow
   - [ ] Remove smart wallet creation for DCA
   - [ ] Update DCADashboard with OpenOcean statuses
   - [ ] Add price range configuration UI
   - [ ] Update order cancellation flow

7. **Migration** (High Priority)
   - [ ] Create migration plan for active orders
   - [ ] Build order migration script
   - [ ] Implement rollback mechanism
   - [ ] Create user notification system
   - [ ] Test migration with subset of orders

8. **Testing** (Critical)
   - [ ] Unit tests for SDK integration
   - [ ] Integration tests with OpenOcean API
   - [ ] Test minimum amount requirements ($5 on Base)
   - [ ] Test time interval constraints (>60s)
   - [ ] Test platform fee collection
   - [ ] Load test with concurrent orders
   - [ ] Test order status transitions

### If maintaining current implementation:

1. **Optimization** (Recommended)
   - [ ] Enhance OpenOcean routing integration
   - [ ] Add multi-route comparison
   - [ ] Implement better slippage protection
   - [ ] Add MEV protection

## Validation Gates

```bash
# 1. Test SDK installation and initialization
bun run test src/test/openocean-sdk-init.test.ts

# 2. Test signature generation with SDK
bun run test src/test/openocean-dca-signature.test.ts

# 3. Create test DCA order on testnet
bun run test src/test/openocean-dca-create.test.ts

# 4. Query and verify order status
bun run test src/test/openocean-dca-query.test.ts

# 5. Test order cancellation
bun run test src/test/openocean-dca-cancel.test.ts

# 6. Full integration test with real tokens
bun run test:integration src/test/openocean-dca-integration.test.ts

# 7. Load test with multiple concurrent orders
bun run test:load src/test/openocean-dca-load.test.ts
```

### Sample Test Implementation

```typescript
// src/test/openocean-dca-create.test.ts
import { openoceanLimitOrderSdk } from '@openocean.finance/limitorder-sdk';
import { ethers } from 'ethers';

describe('OpenOcean DCA Creation', () => {
  it('should create DCA order with SDK', async () => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    const walletParams = {
      provider,
      signer,
      account: await signer.getAddress(),
      chainId: 8453,
      chainKey: 'base',
      mode: 'Dca'
    };
    
    const orderData = await openoceanLimitOrderSdk.createLimitOrder(
      walletParams,
      {
        makerTokenAddress: USDC_ADDRESS,
        makerTokenDecimals: 6,
        takerTokenAddress: SPX_ADDRESS,
        takerTokenDecimals: 18,
        makerAmount: "10000000", // 10 USDC
        takerAmount: "1",
        expire: '1D'
      }
    );
    
    expect(orderData.signature).toBeDefined();
    expect(orderData.orderHash).toBeDefined();
    expect(orderData.data).toBeDefined();
  });
});
```

## Error Handling Strategy

1. **Signature Generation Failures**
   - Fallback to current custom implementation
   - Log detailed error for debugging
   - Alert user about temporary unavailability

2. **API Rate Limiting**
   - Implement exponential backoff
   - Cache responses where appropriate
   - Use webhook notifications if available

3. **Order Execution Failures**
   - Automatic retry with adjusted parameters
   - Notification system for users
   - Manual intervention options

## Gotchas and Considerations

1. **SDK Availability (Resolved!)**
   - ✅ SDK is publicly available: `@openocean.finance/limitorder-sdk`
   - ✅ Full documentation and examples provided
   - ✅ Supports DCA mode with simple parameter
   - ✅ Handles all signature generation automatically
   - ✅ TypeScript support included

2. **Feature Comparison**
   
   | Feature | Current Custom | OpenOcean DCA |
   |---------|---------------|---------------|
   | Gas Sponsorship | ✅ Via ZeroDev | ❌ User pays gas |
   | Smart Wallets | ✅ KERNEL_V3_2 | ❌ EOA only |
   | Custom Fees | ✅ Full control | ⚠️ 0-5% (20% to OpenOcean) |
   | Execution Control | ✅ Complete | ❌ OpenOcean managed |
   | SPX6900 Optimizations | ✅ Custom logic | ❌ Generic DCA |
   | Cross-chain | ✅ Planned | ⚠️ Limited chains |
   | Min Amount | ✅ Any amount | ❌ $5 minimum |
   | Min Interval | ✅ Any interval | ❌ 60s minimum |

3. **Migration Risks**
   - Cannot migrate smart wallet orders to EOA-based system
   - Users would need to approve tokens to new contract
   - Active orders could be interrupted
   - No rollback once orders are on OpenOcean

4. **Operational Changes**
   - Loss of execution visibility and control
   - Dependency on OpenOcean's execution reliability
   - Cannot customize execution logic
   - Platform fee structure less favorable

## Alternative Recommendations

Given the research findings, consider these alternatives:

1. **Keep Current Implementation**
   - Already working and 80% complete
   - Full control over features and execution
   - Better integration with existing infrastructure

2. **Enhance Current Implementation**
   - Use OpenOcean's advanced routing features
   - Add OpenOcean's price impact calculations
   - Integrate their token lists and liquidity data

3. **Build Adapter Layer**
   - Create abstraction over multiple DCA providers
   - Support both custom and OpenOcean implementations
   - Allow users to choose their preferred provider

## Confidence Score: 8/10 (Dramatically updated from 4/10)

The discovery of the publicly available SDK completely changes the feasibility of this migration:

**Major positive factors:**
- ✅ SDK is publicly available on npm
- ✅ Full documentation with working examples
- ✅ Automatic signature generation solved
- ✅ Support for both Web3.js and Ethers.js
- ✅ TypeScript support included
- ✅ Both browser and server-side compatibility

**Remaining considerations:**
- ⚠️ Feature regression still exists (no gas sponsorship, smart wallets)
- ⚠️ Migration complexity for existing orders
- ⚠️ Minimum amount and interval constraints
- ⚠️ Less control over execution logic

**Updated Recommendation**: 
Migration is now technically feasible and could be implemented relatively quickly. However, consider:

1. **Option A - Full Migration**: 
   - Pros: Offload execution responsibility, reduce infrastructure costs
   - Cons: Loss of advanced features, user experience changes
   - Timeline: 2-3 weeks for full migration

2. **Option B - Dual Support** (Recommended):
   - Keep custom DCA for advanced users (gas-free, smart wallets)
   - Add OpenOcean DCA as an option for simple EOA users
   - Let users choose based on their needs
   - Timeline: 3-4 weeks for both implementations

3. **Option C - Stay Custom**:
   - Continue with current implementation
   - Add OpenOcean routing improvements only
   - Maintain full control and feature set

## Implementation Example for SPX6900

```typescript
// src/services/openOceanDCAService.ts
import { openoceanLimitOrderSdk } from '@openocean.finance/limitorder-sdk';
import { ethers } from 'ethers';
import axios from 'axios';

const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const SPX6900_BASE = '0x50da645f148798F68EF2d7dB7C1CB22A6819bb2C';

export class OpenOceanDCAService {
  async createSPXDCAOrder({
    provider,
    usdcAmount,
    intervalHours,
    numberOfBuys
  }: {
    provider: ethers.BrowserProvider;
    usdcAmount: number; // Total USDC to spend
    intervalHours: number; // Hours between buys
    numberOfBuys: number; // Number of DCA executions
  }) {
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    
    // Configure for DCA mode
    const walletParams = {
      provider,
      signer,
      account: address,
      chainId: 8453,
      chainKey: 'base',
      mode: 'Dca' // Enable DCA mode
    };
    
    // Calculate per-execution amount
    const perExecutionUSDC = usdcAmount / numberOfBuys;
    const makerAmount = (perExecutionUSDC * 1e6).toString(); // USDC has 6 decimals
    
    // Generate order data with SDK
    const orderData = await openoceanLimitOrderSdk.createLimitOrder(
      walletParams,
      {
        makerTokenAddress: USDC_BASE,
        makerTokenDecimals: 6,
        takerTokenAddress: SPX6900_BASE,
        takerTokenDecimals: 18,
        makerAmount: (usdcAmount * 1e6).toString(), // Total amount
        takerAmount: "1", // Let OpenOcean calculate
        gasPrice: await this.getGasPrice(provider),
        expire: this.calculateExpiry(intervalHours, numberOfBuys)
      }
    );
    
    // Create DCA order
    const dcaOrder = {
      ...orderData,
      expireTime: intervalHours * numberOfBuys * 3600, // seconds
      time: intervalHours * 3600, // interval in seconds
      times: numberOfBuys,
      version: 'v2',
      referrer: "0xC9860f5D7b80015D0Ff3E440d0f8dB90A518F7E7", // SPX fee address
      referrerFee: "1" // 1% platform fee
    };
    
    // Submit to OpenOcean
    const response = await axios.post(
      'https://open-api.openocean.finance/v1/8453/dca/swap',
      dcaOrder,
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    return {
      orderHash: orderData.orderHash,
      totalAmount: usdcAmount,
      perExecution: perExecutionUSDC,
      intervals: numberOfBuys,
      ...response.data
    };
  }
  
  private async getGasPrice(provider: ethers.BrowserProvider) {
    const feeData = await provider.getFeeData();
    return (Number(feeData.gasPrice) * 1.2).toString();
  }
  
  private calculateExpiry(hours: number, times: number): string {
    const totalHours = hours * times;
    if (totalHours <= 24) return '1D';
    if (totalHours <= 168) return '7D';
    if (totalHours <= 720) return '30D';
    if (totalHours <= 2160) return '3Month';
    return '6Month';
  }
}
```

## References

- Current Implementation: `/src/services/simpleDCAService.ts`
- OpenOcean Integration: `/src/utils/openOceanApi.ts`
- Previous Test: `/src/app/openocean-dca-test/page.tsx`
- Documentation: `/DCA-V2-IMPLEMENTATION.md`
- SDK Documentation: https://github.com/openocean-finance/OpenOcean-limit-order
- NPM Package: https://www.npmjs.com/package/@openocean.finance/limitorder-sdk