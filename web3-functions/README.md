# Gelato Web3 Functions - DCA Automation

This directory contains the Gelato Web3 Function for automated DCA execution.

## Quick Start

### 1. Install Dependencies
```bash
cd web3-functions
npm install
```

### 2. Test Function Locally
```bash
npm run test
```

### 3. Deploy to Gelato
```bash
npm run deploy
```

### 4. Create Task (Alternative to Dashboard)
```bash
npm run create-task
```

## Files

- `dcaAutomationFunction.ts` - Main Web3 Function code
- `schema.json` - Function configuration schema
- `hardhat.config.ts` - Hardhat configuration for deployment
- `package.json` - Dependencies and scripts

## Environment Variables Required

```bash
GELATO_DEPLOYER_PRIVATE_KEY=your_wallet_private_key
UPSTASH_REDIS_REST_URL=your_redis_url
AGENT_KEY_ENCRYPTION_SECRET=your_encryption_secret
NEXT_PUBLIC_ZERODEV_RPC_URL=your_zerodev_rpc_url
GELATO_API_KEY=your_gelato_api_key
```

## Monitoring

After deployment, monitor your function at:
- [Gelato Dashboard](https://app.gelato.network)
- Task execution logs
- Gas usage and costs
- Success/failure rates