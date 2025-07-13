# Gelato Web3 Functions Deployment Guide

## 📋 Prerequisites for Gelato Dashboard Deployment

### 1. **Gelato Account Setup**
- [ ] Create account at [app.gelato.network](https://app.gelato.network)
- [ ] Connect your wallet (the one that will manage tasks)
- [ ] Verify your account with email

### 2. **Required Environment Variables**
```bash
# In your .env.local file
GELATO_API_KEY=your_gelato_api_key_here
GELATO_DEPLOYER_PRIVATE_KEY=your_deployer_wallet_private_key
GELATO_WEB3_FUNCTION_HASH=will_be_generated_after_deployment
```

### 3. **Files Ready for Deployment**
✅ Already created:
- `src/gelato/dcaAutomationFunction.ts` - Main Web3 Function
- `src/gelato/schema.json` - Function configuration
- `src/gelato/hardhat.config.ts` - Hardhat configuration

### 4. **Dependencies to Install**
```bash
# Install Gelato SDK and dependencies
npm install @gelatonetwork/web3-functions-sdk
npm install @nomiclabs/hardhat-ethers ethers hardhat
```

## 🚀 Deployment Steps

### Step 1: Install Gelato CLI
```bash
npm install -g @gelatonetwork/web3-functions-sdk
```

### Step 2: Initialize Gelato Project Structure
```bash
# Navigate to your project root
cd /path/to/your/project

# Create Gelato workspace
mkdir -p web3-functions
cp src/gelato/* web3-functions/
```

### Step 3: Login to Gelato CLI
```bash
w3f login
# This will open browser to authenticate with Gelato
```

### Step 4: Deploy Web3 Function
```bash
cd web3-functions
w3f deploy dcaAutomationFunction.ts --network base
```

### Step 5: Create Task via Dashboard
1. Go to [app.gelato.network](https://app.gelato.network)
2. Navigate to "Web3 Functions" 
3. Click "Create Task"
4. Select your deployed function
5. Configure trigger (time-based, every 5 minutes recommended)
6. Set user arguments (see configuration below)

## ⚙️ Configuration Requirements

### User Arguments for Gelato Task
```json
{
  "redisUrl": "your_upstash_redis_url",
  "encryptionSecret": "your_agent_key_encryption_secret",
  "zerodevRpcUrl": "your_zerodev_rpc_url",
  "adminWalletAddress": "0x_your_admin_wallet_address"
}
```

### Task Configuration
- **Network**: Base (Chain ID: 8453)
- **Trigger**: Time-based interval (recommended: 300 seconds / 5 minutes)
- **Gas Limit**: 500,000 gas units
- **Memory**: 128 MB
- **Timeout**: 30 seconds

## 💰 Funding Requirements

### 1. **ETH for Gas**
- Minimum: 0.1 ETH on Base network
- Recommended: 0.5 ETH for extended operation
- Deposits can be made through Gelato dashboard

### 2. **Task Treasury**
- Each task needs its own ETH balance
- Funds are deducted per execution
- Auto-refill can be configured

## 🔧 Alternative: Programmatic Deployment

If you prefer to deploy programmatically, here's the setup:

### Create deployment script:
```typescript
// scripts/deploy-gelato.ts
import { GelatoOpsSDK } from "@gelatonetwork/ops-sdk";

async function deployGelatoTask() {
  const gelatoOps = new GelatoOpsSDK(8453, signer); // Base chain
  
  const taskArgs = {
    name: "DCA-Automation-Task",
    execAddress: "0x...", // Your deployed function address
    execSelector: "0x...", // Function selector
    dedicatedMsgSender: false,
    useTaskTreasuryFunds: true,
    resolverAddress: "0x...", // Resolver contract if needed
    resolverData: "0x"
  };
  
  const { taskId, tx } = await gelatoOps.createTask(taskArgs);
  console.log(`Task created: ${taskId}`);
  console.log(`Transaction: ${tx.hash}`);
}
```

## 📊 Monitoring Setup

### Dashboard Monitoring
- Real-time execution logs
- Gas usage analytics  
- Success/failure rates
- Balance monitoring

### API Monitoring (Optional)
```typescript
// Monitor via API
const response = await fetch(`https://api.gelato.digital/tasks/${taskId}`, {
  headers: {
    'Authorization': `Bearer ${GELATO_API_KEY}`
  }
});
```

## 🔐 Security Considerations

### 1. **Private Key Management**
```bash
# Use environment variables, never commit keys
GELATO_DEPLOYER_PRIVATE_KEY=0x...
```

### 2. **Access Control**
- Only your wallet can modify/cancel tasks
- Use dedicated deployer wallet with minimal funds
- Regular key rotation recommended

### 3. **User Arguments Security**
- Encryption secrets should be long and random
- Redis URLs should use TLS
- Never expose sensitive data in logs

## 🚨 Troubleshooting

### Common Issues:

1. **Deployment Fails**
```bash
# Check node version (requires Node 16+)
node --version

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

2. **Function Execution Fails**
- Check gas limit (increase to 800,000 if needed)
- Verify user arguments format
- Check network connectivity to Redis/APIs

3. **Task Not Triggering**
- Verify trigger configuration
- Check task balance (needs ETH)
- Review execution logs in dashboard

## 📈 Performance Optimization

### Recommended Settings:
```json
{
  "memory": 128,
  "timeout": 30,
  "maxExecutionsPerRun": 5,
  "executionInterval": 300
}
```

### Cost Optimization:
- Use time-based triggers (cheaper than condition-based)
- Batch multiple operations when possible
- Monitor gas usage and optimize function logic

## 🎯 Next Steps After Deployment

1. **Test with Small Amounts**
   - Create test DCA order with $1-5
   - Verify execution works correctly
   - Check all monitoring systems

2. **Gradual Rollout**
   - Start with limited user base
   - Monitor performance metrics
   - Scale up based on success

3. **Production Monitoring**
   - Set up alerts for failures
   - Monitor gas costs
   - Track user satisfaction

## 📞 Support Resources

- **Gelato Documentation**: [docs.gelato.network](https://docs.gelato.network)
- **Gelato Discord**: [discord.gg/ApbA39BKyJ](https://discord.gg/ApbA39BKyJ)
- **Web3 Functions Guide**: [docs.gelato.network/web3-services/web3-functions](https://docs.gelato.network/web3-services/web3-functions)

## ✅ Deployment Checklist

- [ ] Gelato account created and verified
- [ ] Environment variables configured
- [ ] Dependencies installed
- [ ] Web3 Function deployed
- [ ] Task created in dashboard
- [ ] Task funded with ETH
- [ ] User arguments configured
- [ ] Test execution successful
- [ ] Monitoring setup complete
- [ ] Production rollout planned

Ready to deploy! 🚀