# Owner/Agent Session Key Migration Guide

This guide explains how to migrate from the current session key implementation to the new secure owner/agent session key flow.

## Overview

The new architecture implements a secure session key pattern where:

1. **Owner** creates and controls the smart wallet
2. **Agent** generates a key pair and shares only the public key
3. **Owner** authorizes the agent's public key with specific permissions
4. **Agent** combines their private key with the authorization to execute transactions

## Key Benefits

### Security Improvements
- ✅ Agent's private key never leaves their environment
- ✅ Owner maintains full control and can revoke access anytime
- ✅ Scoped permissions prevent unauthorized operations
- ✅ Time-bound access with automatic expiration
- ✅ Paymaster requirement prevents gas manipulation

### Technical Improvements
- ✅ KERNEL_V3_2 support for chain abstraction
- ✅ Modern ZeroDev v5 API compatibility
- ✅ Proper ERC-7579 module system integration
- ✅ Enhanced permissions system with granular controls

## Migration Steps

### 1. Update Dependencies

Ensure you have the latest ZeroDev packages:

```json
{
  "@zerodev/sdk": "^5.4.39",
  "@zerodev/ecdsa-validator": "^5.4.9",
  "@zerodev/session-key": "^5.5.3",
  "@zerodev/permissions": "^5.5.10"
}
```

### 2. Replace Old Service

Replace `zerodevSessionKeyService.ts` usage with `ownerAgentSessionKeyService.ts`:

```typescript
// OLD: Direct session key creation
import { zerodevSessionKeyService } from '../services/zerodevSessionKeyService';

// NEW: Owner/Agent flow
import { ownerAgentSessionKeyService } from '../services/ownerAgentSessionKeyService';
```

### 3. Update DCA Order Creation Flow

#### Old Flow
```typescript
// User creates session key directly
const sessionKeyData = await zerodevSessionKeyService.createSessionKey(
  smartWalletAddress,
  userWalletAddress,
  totalAmount,
  orderSizeAmount,
  durationDays
);
```

#### New Flow
```typescript
// STEP 1: Owner creates smart wallet (one-time setup)
const ownerPrivateKey = generatePrivateKey(); // Store securely
const ownerSmartWallet = await ownerAgentSessionKeyService.createOwnerSmartWallet(ownerPrivateKey);

// STEP 2: Agent creates key pair (server-side)
const agentKeyPair = await ownerAgentSessionKeyService.createAgentKeyPair();

// STEP 3: Owner authorizes agent (user signs authorization)
const serializedSessionKey = await ownerAgentSessionKeyService.authorizeAgentSessionKey(
  ownerPrivateKey,
  ownerSmartWallet.address,
  agentKeyPair.agentAddress,
  userWalletAddress,
  totalAmount,
  durationDays
);

// STEP 4: Agent creates full session key (server-side)
const agentSessionKey = await ownerAgentSessionKeyService.createAgentSessionKey(
  serializedSessionKey,
  agentKeyPair.agentPrivateKey,
  userWalletAddress,
  ownerSmartWallet.address,
  validAfter,
  validUntil
);
```

### 4. Update DCA Execution

#### Old Flow
```typescript
const result = await zerodevSessionKeyService.executeDCASwap(
  sessionKeyData,
  swapAmount,
  destinationAddress
);
```

#### New Flow
```typescript
const result = await ownerAgentSessionKeyService.executeDCASwap(
  agentSessionKey,
  swapAmount,
  destinationAddress
);
```

### 5. Add Session Key Revocation

```typescript
// Owner can revoke specific agent or all session keys
const revocationResult = await ownerAgentSessionKeyService.revokeSessionKey(
  ownerPrivateKey,
  smartWalletAddress,
  agentAddress // Optional: specific agent to revoke
);
```

## API Endpoints Updates

### DCA Order Creation Endpoint

Update `/api/dca/create` to implement the new flow:

```typescript
// POST /api/dca/create
export async function POST(request: Request) {
  const { userWalletAddress, totalAmount, orderSizeAmount, durationDays } = await request.json();
  
  // Step 1: Create owner smart wallet
  const ownerPrivateKey = generatePrivateKey(); // Store securely in database
  const ownerSmartWallet = await ownerAgentSessionKeyService.createOwnerSmartWallet(ownerPrivateKey);
  
  // Step 2: Create agent key pair (server-side)
  const agentKeyPair = await ownerAgentSessionKeyService.createAgentKeyPair();
  
  // Return authorization request to user
  return Response.json({
    smartWalletAddress: ownerSmartWallet.address,
    agentAddress: agentKeyPair.agentAddress,
    authorizationData: {
      totalAmount,
      durationDays,
      permissions: ['USDC_APPROVE', 'SWAP_EXECUTE', 'SPX_TRANSFER']
    }
  });
}
```

### Authorization Endpoint

Add new endpoint for user to authorize agent:

```typescript
// POST /api/dca/authorize
export async function POST(request: Request) {
  const { 
    ownerSignature, 
    smartWalletAddress, 
    agentAddress, 
    userWalletAddress,
    totalAmount,
    durationDays 
  } = await request.json();
  
  // Verify owner signature and authorize agent
  const serializedSessionKey = await ownerAgentSessionKeyService.authorizeAgentSessionKey(
    ownerPrivateKey, // Retrieved from secure storage
    smartWalletAddress,
    agentAddress,
    userWalletAddress,
    totalAmount,
    durationDays
  );
  
  // Store session key data
  await database.storeDCAOrder({
    smartWalletAddress,
    agentAddress,
    serializedSessionKey,
    // ... other fields
  });
  
  return Response.json({ success: true });
}
```

## Database Schema Updates

Add new fields to support owner/agent architecture:

```sql
-- Add to DCA orders table
ALTER TABLE dca_orders ADD COLUMN owner_address VARCHAR(42);
ALTER TABLE dca_orders ADD COLUMN agent_address VARCHAR(42);
ALTER TABLE dca_orders ADD COLUMN agent_private_key TEXT; -- Encrypted
ALTER TABLE dca_orders ADD COLUMN serialized_session_key TEXT;
ALTER TABLE dca_orders ADD COLUMN kernel_version VARCHAR(10) DEFAULT 'v3.2';

-- Create session key management table
CREATE TABLE session_keys (
  id SERIAL PRIMARY KEY,
  smart_wallet_address VARCHAR(42) NOT NULL,
  owner_address VARCHAR(42) NOT NULL,
  agent_address VARCHAR(42) NOT NULL,
  serialized_key TEXT NOT NULL,
  valid_after INTEGER NOT NULL,
  valid_until INTEGER NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Frontend Integration

### User Authorization Flow

```typescript
// 1. User initiates DCA order
const createResponse = await fetch('/api/dca/create', {
  method: 'POST',
  body: JSON.stringify({
    userWalletAddress: wallet.address,
    totalAmount: '1000000000', // 1000 USDC
    orderSizeAmount: '50000000', // 50 USDC per execution
    durationDays: 30
  })
});

const { smartWalletAddress, agentAddress, authorizationData } = await createResponse.json();

// 2. User signs authorization (using their wallet)
const authMessage = createAuthorizationMessage(authorizationData);
const signature = await wallet.signMessage(authMessage);

// 3. Submit authorization
await fetch('/api/dca/authorize', {
  method: 'POST',
  body: JSON.stringify({
    ownerSignature: signature,
    smartWalletAddress,
    agentAddress,
    userWalletAddress: wallet.address,
    ...authorizationData
  })
});
```

### Smart Wallet Integration

```typescript
// Update smart wallet creation to use owner/agent pattern
const createSmartWallet = async (userWallet: any) => {
  // User's wallet becomes the owner
  const ownerSmartWallet = await ownerAgentSessionKeyService.createOwnerSmartWallet(
    userWallet.privateKey // In practice, get from secure signature
  );
  
  return ownerSmartWallet;
};
```

## Testing

Run the comprehensive test suite:

```typescript
import { runAllTests } from '../test/owner-agent-session-key-test';

// Run all tests
const results = await runAllTests();
console.log('Test Results:', results);
```

## Security Considerations

### Key Management
- ✅ Owner private keys should be derived from user signatures, not stored
- ✅ Agent private keys stored encrypted on server
- ✅ Session keys have automatic expiration
- ✅ Implement proper key rotation policies

### Permission Scoping
- ✅ Session keys limited to specific DCA operations
- ✅ Amount limits enforced at permission level
- ✅ Destination addresses restricted to user wallet
- ✅ Paymaster requirement prevents gas attacks

### Monitoring
- ✅ Log all session key operations
- ✅ Monitor for unusual activity patterns
- ✅ Implement rate limiting for agent operations
- ✅ Alert on failed authorization attempts

## Rollback Plan

If issues arise, you can temporarily fall back to the old system:

1. Keep `zerodevSessionKeyService.ts` available
2. Use feature flag to switch between old/new flows
3. Migrate users gradually rather than all at once
4. Monitor error rates and performance metrics

## Support

For issues with the new owner/agent session key implementation:

1. Check the test results: `npm run test:session-keys`
2. Review logs for permission errors
3. Verify KERNEL_V3_2 compatibility
4. Ensure ZeroDev project configuration is correct

## Next Steps

After migration:

1. Implement cross-chain DCA using chain abstraction features
2. Add more sophisticated permission policies
3. Integrate with additional DEX protocols
4. Implement advanced DCA strategies (time-weighted, price-based triggers)