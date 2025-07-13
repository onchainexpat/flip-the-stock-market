# 🚀 Solidity Function Deployment Guide

## ✅ Step 1: Setup Complete
✅ Contract compiled successfully  
✅ Deployment script ready  
✅ All files in place  

## 🔧 Step 2: Environment Setup

### Add to your `.env.local` file:
```bash
# Deployment wallet (create a new one for security)
GELATO_DEPLOYER_PRIVATE_KEY=0x_your_private_key_here

# Contract address (will be set after deployment)
DCA_RESOLVER_ADDRESS=your_contract_address_here
```

### 💰 Fund Your Deployer Wallet
You need **0.1+ ETH on Base network** for:
- Contract deployment (~$2-5)
- Gelato task funding (~$50-100 for extended operation)

**How to get ETH on Base:**
1. **Bridge from Ethereum**: Use [bridge.base.org](https://bridge.base.org)
2. **CEX Withdrawal**: Coinbase, Binance, etc. (select Base network)
3. **Buy directly**: Some DEXs support Base

## 🚀 Step 3: Deploy Contract

Once you have the private key and ETH:

```bash
# Navigate to contracts directory
cd contracts

# Deploy the contract
node deploy-local.js
```

**Expected Output:**
```
✅ DCAAutomationResolver deployed successfully!
📋 Contract Address: 0x1234567890123456789012345678901234567890
📋 Transaction Hash: 0xabcdef...
```

## 🎯 Step 4: Gelato Dashboard Configuration

### Go to [app.gelato.network](https://app.gelato.network)

1. **Click "New Function Task"**
2. **Select "Solidity Function"** (not grayed out)
3. **Configure:**
   ```
   Network: Base
   Contract Address: [Your deployed contract address]
   Function: checker()
   ```

4. **Set Trigger:**
   ```
   Trigger Type: Time Interval
   Interval: 5 minutes (300 seconds)
   ```

5. **Advanced Settings:**
   ```
   ✅ Transaction pays itself
   ❌ Single execution task
   Task Name: DCA-Automation-Production
   ```

6. **Fund Task:**
   - Add 0.1+ ETH to task treasury
   - This pays for gas fees

## 📊 Step 5: Verify Setup

### Check Contract on Basescan:
- Go to `https://basescan.org/address/YOUR_CONTRACT_ADDRESS`
- Verify it shows as deployed
- Check the contract code

### Check Gelato Task:
- Task should show "Active" status
- Balance should show your funding
- First execution should happen within 5 minutes

## 🔧 Step 6: Integration with Existing DCA

Now you need to modify your DCA creation to work with the contract:

### Update DCA Order Creation:
```typescript
// Instead of creating server-only orders, also register with contract
const orderId = ethers.utils.keccak256(
  ethers.utils.defaultAbiCoder.encode(
    ['address', 'uint256'],
    [userAddress, Date.now()]
  )
);

// Call contract to register order
await resolverContract.createOrder(
  orderId,
  userAddress,
  smartWalletAddress,
  agentKeyId,
  TOKENS.USDC,
  TOKENS.SPX6900,
  amountPerExecution,
  frequency,
  totalExecutions
);
```

## 🎛️ Contract Management Functions

Your deployed contract has these functions:

### **For Order Management:**
- `createOrder()` - Add new DCA order
- `cancelOrder()` - Cancel active order  
- `getOrder()` - Get order details
- `getUserOrders()` - Get user's orders

### **For Gelato (Automatic):**
- `checker()` - Gelato calls this every 5 minutes
- `executeOrders()` - Gelato calls this when orders are ready

### **For Monitoring:**
- `getReadyOrders()` - See which orders are ready
- `getTotalOrders()` - Get total order count

## 🔍 Testing Your Setup

### 1. Deploy Contract ✅
```bash
cd contracts && node deploy-local.js
```

### 2. Create Gelato Task ✅
Use dashboard with your contract address

### 3. Test Order Creation ✅
```typescript
// Create a test order with small amount
const testOrderId = "0x" + "test".padEnd(64, "0");
await contract.createOrder(
  testOrderId,
  userAddress,
  smartWalletAddress,
  "test_agent_key",
  TOKENS.USDC,
  TOKENS.SPX6900,
  "1000000", // 1 USDC
  300, // 5 minutes
  1 // 1 execution
);
```

### 4. Monitor Execution ✅
- Check Gelato dashboard for execution logs
- Monitor contract events on Basescan
- Verify DCA orders execute correctly

## 🚨 Troubleshooting

### Deployment Issues:
```bash
# Check balance
npx hardhat run --network base scripts/check-balance.js

# Verify RPC connection
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  $NEXT_PUBLIC_ZERODEV_RPC_URL
```

### Gelato Task Issues:
- **Task not executing**: Check task balance and trigger settings
- **Execution failures**: Check contract has orders ready
- **Gas errors**: Increase task funding

### Contract Issues:
- **Orders not ready**: Check time intervals and order status
- **Permission errors**: Ensure proper owner setup

## 📋 Environment Variables Summary

Add these to `.env.local`:
```bash
# Required for deployment
GELATO_DEPLOYER_PRIVATE_KEY=0x_your_private_key

# Set after deployment
DCA_RESOLVER_ADDRESS=0x_your_contract_address

# Required for operation (existing)
UPSTASH_REDIS_REST_URL=your_redis_url
AGENT_KEY_ENCRYPTION_SECRET=your_encryption_secret
NEXT_PUBLIC_ZERODEV_RPC_URL=your_zerodev_rpc_url
```

## 🎉 Success Metrics

You'll know it's working when:
- ✅ Contract deploys successfully
- ✅ Gelato task shows "Active" 
- ✅ First execution happens within 5 minutes
- ✅ Test DCA order executes correctly
- ✅ Multi-aggregator integration works
- ✅ Orders complete successfully

**Ready to deploy! You just need to add the private key to proceed! 🚀**