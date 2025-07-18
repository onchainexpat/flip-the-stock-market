# Gelato Task Debugging Guide

## Problem
Task ID `0x99b0e6d90bec9cc03f2a41dbde9a10fc79f5b24b8cbc57f6e9f4bc7eef0a4309` was created but no transaction appears on Basescan.

## Debugging Endpoints Created

### 1. Check Task Status
```bash
# Check basic task status
curl -X GET "http://localhost:3000/api/gelato/task-status?taskId=0x99b0e6d90bec9cc03f2a41dbde9a10fc79f5b24b8cbc57f6e9f4bc7eef0a4309"

# Check with API key
curl -X POST http://localhost:3000/api/gelato/task-status \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "0x99b0e6d90bec9cc03f2a41dbde9a10fc79f5b24b8cbc57f6e9f4bc7eef0a4309",
    "apiKey": "YOUR_GELATO_API_KEY"
  }'
```

### 2. Test Gelato Relay Configuration
```bash
curl -X POST http://localhost:3000/api/gelato/debug-relay \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_GELATO_API_KEY",
    "testMode": true
  }'
```

### 3. Test Sponsorship Setup
```bash
curl -X POST http://localhost:3000/api/gelato/test-sponsorship \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_GELATO_API_KEY",
    "userAddress": "0x22F7D3e8E085b6d8B7d3fE11E06B9391eE858779"
  }'
```

### 4. Run Full Diagnostics
```bash
curl -X POST http://localhost:3000/api/gelato/diagnose \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "0x99b0e6d90bec9cc03f2a41dbde9a10fc79f5b24b8cbc57f6e9f4bc7eef0a4309",
    "apiKey": "YOUR_GELATO_API_KEY",
    "userAddress": "0x22F7D3e8E085b6d8B7d3fE11E06B9391eE858779"
  }'
```

### 5. Debug Script
```bash
# Run the debugging script
bun run src/scripts/debug-gelato-task.ts 0x99b0e6d90bec9cc03f2a41dbde9a10fc79f5b24b8cbc57f6e9f4bc7eef0a4309
```

## Common Issues Identified

### 1. API Key Format Issues
- **Problem**: API key might include "Bearer " prefix or have whitespace
- **Solution**: Use only the raw API key without any prefix
- **Check**: The API key should be alphanumeric with possible underscores/hyphens

### 2. Task ID vs Transaction Hash
- **Problem**: The code returns `response.taskId` but uses it as both `userOpHash` and `txHash`
- **Issue**: Task IDs are not transaction hashes - they need to be resolved
- **Solution**: After creating a task, poll for status to get the actual transaction hash

### 3. Missing Task Status Polling
- **Problem**: The GelatoNativeSmartWalletService doesn't wait for task execution
- **Current code**:
  ```typescript
  return {
    success: true,
    userOpHash: response.taskId,
    txHash: response.taskId, // This is wrong - taskId is not txHash
  };
  ```
- **Solution**: Implement task status polling like in GelatoSmartWalletService

### 4. Potential Chain ID Issues
- **Problem**: Base chain (8453) might not be properly configured
- **Check**: Verify Base is enabled in your Gelato project dashboard

### 5. User Address Authorization
- **Problem**: The user address might not be authorized to execute transactions
- **Note**: For Gelato Relay, the `user` field in the request must be the address that will execute the transaction

## Recommended Fixes

### 1. Update GelatoNativeSmartWalletService
Add task status polling to get the actual transaction hash:

```typescript
// After getting response.taskId
const taskStatus = await this.waitForTaskExecution(response.taskId);
if (taskStatus.success && taskStatus.txHash) {
  return {
    success: true,
    userOpHash: response.taskId,
    txHash: taskStatus.txHash, // Use actual tx hash
  };
}
```

### 2. Add waitForTaskExecution Method
```typescript
private static async waitForTaskExecution(
  taskId: string,
  maxAttempts = 30,
  delayMs = 2000
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const relay = new GelatoRelay();
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const status = await relay.getTaskStatus(taskId);
      
      if (status.taskState === 'ExecSuccess' && status.transactionHash) {
        return {
          success: true,
          txHash: status.transactionHash,
        };
      }
      
      if (status.taskState === 'ExecReverted' || status.taskState === 'Cancelled') {
        return {
          success: false,
          error: `Task ${status.taskState}: ${status.lastCheckMessage || 'Unknown error'}`,
        };
      }
      
      // Still pending, wait and retry
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } catch (error) {
      console.error(`Error checking task status (attempt ${i + 1}):`, error);
    }
  }
  
  return {
    success: false,
    error: 'Task execution timeout',
  };
}
```

### 3. Environment Variable Check
Ensure these are properly set:
```bash
GELATO_SPONSOR_API_KEY=your_actual_api_key_here  # No "Bearer " prefix
```

## Next Steps

1. Run the diagnostic endpoints to check your specific task
2. Verify your API key format and permissions
3. Check if Base network is enabled in Gelato dashboard
4. Implement the task status polling fix
5. Monitor the logs for any authentication or permission errors

## Additional Resources
- [Gelato Relay Docs](https://docs.gelato.network/developer-services/relay)
- [Gelato Dashboard](https://app.gelato.network/)
- [Base Network on Gelato](https://docs.gelato.network/developer-services/relay/supported-networks)