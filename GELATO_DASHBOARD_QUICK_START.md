# 🚀 Gelato Dashboard Quick Start Guide

## What You Need from the Gelato Dashboard

### 1. **Account & Authentication**
```
🔗 URL: https://app.gelato.network
👤 Account: Connect your wallet (same one that will deploy)
🔑 API Key: Get from Settings → API Keys
```

### 2. **Dashboard Navigation**
```
📱 Web3 Functions: Where you'll deploy and manage functions
📋 Tasks: Where you'll create and monitor automation tasks
💰 Treasury: Where you'll fund your tasks with ETH
📊 Analytics: Monitor performance and costs
```

## 🎯 **Step-by-Step Dashboard Deployment**

### **Step 1: Get Your API Key**
1. Go to [app.gelato.network](https://app.gelato.network)
2. Connect your wallet
3. Navigate to **Settings** → **API Keys**
4. Click **"Create API Key"**
5. Copy and save the API key

```bash
# Add to .env.local
GELATO_API_KEY=your_api_key_here
```

### **Step 2: Prepare Your Deployer Wallet**
1. Create a new wallet for deployment (recommended)
2. Send 0.2+ ETH to it (Base network)
3. Export private key

```bash
# Add to .env.local  
GELATO_DEPLOYER_PRIVATE_KEY=0x_your_private_key_here
```

### **Step 3: Deploy Web3 Function**

**Option A: Via CLI (Recommended)**
```bash
# Install dependencies and setup
./scripts/setup-gelato.sh

# Login to Gelato
npx w3f login

# Deploy function
npm run gelato:deploy
```

**Option B: Via Dashboard Upload**
1. Go to **Web3 Functions** → **Deploy Function**
2. Upload `web3-functions/dcaAutomationFunction.ts`
3. Upload `web3-functions/schema.json`
4. Set network to **Base (8453)**
5. Click **Deploy**

### **Step 4: Create Automation Task**
1. Go to **Tasks** → **Create Task**
2. Select your deployed function
3. Configure settings:

```json
{
  "name": "DCA-Automation-Production",
  "network": "base",
  "trigger": {
    "type": "time",
    "interval": "300000"
  },
  "userArgs": {
    "redisUrl": "your_upstash_redis_url",
    "encryptionSecret": "your_encryption_secret", 
    "zerodevRpcUrl": "your_zerodev_rpc_url",
    "adminWalletAddress": "your_admin_wallet"
  }
}
```

4. Click **Create Task**
5. **Copy the Task ID** (you'll need this!)

### **Step 5: Fund Your Task**
1. In the task details page, click **"Fund Task"**
2. Add **0.1+ ETH** (Base network)
3. Confirm transaction
4. Verify funding in **Treasury** section

## 📊 **Dashboard Features You'll Use**

### **Web3 Functions Page**
- **Deploy**: Upload and deploy new functions
- **Update**: Modify existing function code
- **Logs**: View function execution logs
- **Analytics**: Monitor performance metrics

### **Tasks Page**  
- **Create**: Set up new automation tasks
- **Monitor**: Real-time execution status
- **Fund**: Add ETH for gas payments
- **Pause/Resume**: Control task execution

### **Treasury Page**
- **Balance**: View available ETH balance
- **Transactions**: History of gas payments
- **Top Up**: Add more ETH when needed
- **Withdraw**: Remove unused funds

### **Analytics Page**
- **Execution Count**: Total function runs
- **Success Rate**: Percentage of successful executions
- **Gas Usage**: Average gas consumption
- **Costs**: ETH spent on execution

## 🔧 **Configuration Templates**

### **User Arguments Template**
```json
{
  "redisUrl": "https://your-redis.upstash.io",
  "encryptionSecret": "your-32-char-encryption-secret",
  "zerodevRpcUrl": "https://rpc.zerodev.app/api/v3/your-project-id/chain/8453",
  "adminWalletAddress": "0x_your_admin_wallet_address"
}
```

### **Trigger Configuration**
```json
{
  "type": "time",
  "interval": 300000,
  "description": "Execute every 5 minutes"
}
```

## 🚨 **Important Dashboard Settings**

### **Function Settings**
- **Memory**: 128 MB
- **Timeout**: 30 seconds  
- **Network**: Base (8453)
- **Runtime**: js-1.0

### **Task Settings**
- **Dedicated MSG Sender**: false
- **Use Task Treasury**: true
- **Single Execution**: false
- **Max Executions**: unlimited

### **Security Settings**
- **Only You Can**: Modify/Cancel tasks
- **Function Visibility**: Private
- **API Access**: Restrict by IP (optional)

## 📈 **Monitoring & Alerts**

### **Dashboard Monitoring**
- ✅ **Execution Logs**: Real-time function output
- ✅ **Error Tracking**: Failed execution details  
- ✅ **Gas Analytics**: Cost optimization insights
- ✅ **Balance Alerts**: Low balance notifications

### **Set Up Alerts**
1. Go to **Settings** → **Notifications**
2. Enable **Email Alerts** for:
   - Task execution failures
   - Low balance warnings
   - Function deployment updates
3. Set alert thresholds:
   - Balance below 0.01 ETH
   - Success rate below 95%

## 🎯 **Success Checklist**

After dashboard setup, verify:

- [ ] **Function Deployed**: Shows in Web3 Functions list
- [ ] **Task Created**: Shows in Tasks list with "Active" status
- [ ] **Task Funded**: Treasury shows positive ETH balance  
- [ ] **First Execution**: Logs show successful runs
- [ ] **DCA Integration**: Test orders execute correctly
- [ ] **Monitoring Active**: Alerts and analytics working

## 🆘 **Troubleshooting Dashboard Issues**

### **Function Deployment Fails**
```
❌ Error: "Function upload failed"
✅ Solution: Check file size (<10MB) and syntax
```

### **Task Creation Fails** 
```
❌ Error: "Invalid user arguments"
✅ Solution: Validate JSON format in user args
```

### **Execution Failures**
```
❌ Error: "Insufficient funds"
✅ Solution: Add more ETH to task treasury
```

### **API Key Issues**
```
❌ Error: "Unauthorized"
✅ Solution: Regenerate API key and update env vars
```

## 🎉 **You're Ready!**

Once setup through dashboard:
1. **Task ID**: Save your task ID to `.env.local`
2. **Monitor**: Check dashboard daily for first week
3. **Scale**: Create additional tasks as needed
4. **Optimize**: Adjust intervals based on usage

Your DCA automation is now running on Gelato's decentralized network! 🚀