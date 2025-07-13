import { http } from 'viem';
import {
  KERNEL_V3_1,
  TEST_CONFIG,
  checkUSDCBalance,
  createKernelAccount,
  createKernelAccountClient,
  generatePrivateKey,
  getEntryPoint,
  log,
  paymasterClient,
  privateKeyToAccount,
  publicClient,
  signerToEcdsaValidator,
} from './config';

export interface DeploymentResult {
  smartWalletAddress: string;
  demoPrivateKey: string;
  masterAccount: any;
  ecdsaValidator: any;
  kernelAccount: any;
  kernelClient: any;
}

/**
 * Test Case 1: Basic Smart Wallet Deployment
 * Purpose: Verify ZeroDev v3 can deploy smart wallets with paymaster on Base Sepolia
 */
export async function testSmartWalletDeployment(): Promise<DeploymentResult> {
  log('🧪 Test 1: Starting smart wallet deployment test...');

  try {
    // 1. Generate demo EOA
    log('📱 Step 1: Generating demo EOA...');
    const demoPrivateKey = generatePrivateKey();
    const demoAccount = privateKeyToAccount(demoPrivateKey);
    log(`✅ Demo EOA created: ${demoAccount.address}`);

    // 2. Create ECDSA validator
    log('🔐 Step 2: Creating ECDSA validator...');
    const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
      signer: demoAccount,
      entryPoint: getEntryPoint('0.7'),
      kernelVersion: KERNEL_V3_1,
    });
    log('✅ ECDSA validator created');

    // 3. Create kernel account (this determines the smart wallet address)
    log('🏗️ Step 3: Creating kernel account...');
    const kernelAccount = await createKernelAccount(publicClient, {
      plugins: {
        sudo: ecdsaValidator,
      },
      entryPoint: getEntryPoint('0.7'),
      kernelVersion: KERNEL_V3_1,
    });

    const smartWalletAddress = kernelAccount.address;
    log(`✅ Kernel account created: ${smartWalletAddress}`);

    // 4. Create kernel client with paymaster
    log('⚡ Step 4: Creating kernel client with paymaster...');
    const kernelClient = createKernelAccountClient({
      account: kernelAccount,
      chain: publicClient.chain,
      bundlerTransport: http(TEST_CONFIG.ZERODEV_RPC_URL),
      paymaster: {
        getPaymasterData: async (userOperation) => {
          log('💰 Requesting paymaster sponsorship...');
          return paymasterClient.sponsorUserOperation({ userOperation });
        },
      },
    });
    log('✅ Kernel client created with paymaster');

    // 5. Check if smart wallet is already deployed
    log('🔍 Step 5: Checking deployment status...');
    const code = await publicClient.getCode({
      address: smartWalletAddress as `0x${string}`,
    });
    const isDeployed = code && code !== '0x';

    if (isDeployed) {
      log(`✅ Smart wallet already deployed: ${smartWalletAddress}`);
    } else {
      log('🚀 Step 6: Deploying smart wallet with sponsored transaction...');

      // Send a simple transaction to trigger deployment
      const txHash = await kernelClient.sendTransaction({
        to: smartWalletAddress as `0x${string}`,
        value: 0n,
        data: '0x',
      });

      log(`✅ Smart wallet deployed! Transaction: ${txHash}`);
      log(`📍 BaseScan: https://sepolia.basescan.org/tx/${txHash}`);

      // Wait for transaction confirmation
      log('⏳ Waiting for transaction confirmation...');
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
      });
      log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
    }

    // 6. Verify deployment
    log('✅ Step 7: Verifying deployment...');
    const finalCode = await publicClient.getCode({
      address: smartWalletAddress as `0x${string}`,
    });
    if (!finalCode || finalCode === '0x') {
      throw new Error('Smart wallet deployment failed - no code at address');
    }

    // 7. Check initial USDC balance
    await checkUSDCBalance(smartWalletAddress);

    const result: DeploymentResult = {
      smartWalletAddress,
      demoPrivateKey,
      masterAccount: demoAccount,
      ecdsaValidator,
      kernelAccount,
      kernelClient,
    };

    log('🎉 Test 1 PASSED: Smart wallet deployment successful!');
    log(`📍 Smart Wallet Address: ${smartWalletAddress}`);

    return result;
  } catch (error) {
    log('❌ Test 1 FAILED: Smart wallet deployment failed');
    console.error('Error details:', error);
    throw error;
  }
}

// Run test if called directly
if (require.main === module) {
  testSmartWalletDeployment()
    .then(() => {
      log('✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      log('❌ Test failed');
      console.error(error);
      process.exit(1);
    });
}
