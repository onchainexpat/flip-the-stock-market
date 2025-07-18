/**
 * Diagnose ZeroDev Address Mismatch Issue
 * 
 * This test specifically diagnoses why the kernel account address changes
 * when creating session keys for an existing smart wallet.
 */

import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createKernelAccount } from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { toPermissionValidator } from '@zerodev/permissions';
import { toSudoPolicy } from '@zerodev/permissions/policies';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import { generatePrivateKey } from 'viem/accounts';

async function diagnoseAddressMismatch() {
  console.log('🔍 Diagnosing ZeroDev Address Mismatch\n');
  
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });
  
  // Step 1: Create original kernel account
  console.log('Step 1: Creating original kernel account...');
  const ownerPrivateKey = generatePrivateKey();
  const owner = privateKeyToAccount(ownerPrivateKey);
  
  const entryPoint = getEntryPoint('0.7');
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: owner,
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });
  
  const originalAccount = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });
  
  console.log('✅ Original account address:', originalAccount.address);
  
  // Step 2: Try to create account with same address but different plugin
  console.log('\nStep 2: Creating account with permission plugin...');
  const sessionPrivateKey = generatePrivateKey();
  const sessionAccount = privateKeyToAccount(sessionPrivateKey);
  
  const sessionKeySigner = await toECDSASigner({ signer: sessionAccount });
  
  const permissionPlugin = await toPermissionValidator(publicClient, {
    entryPoint,
    kernelVersion: KERNEL_V3_1,
    signer: sessionKeySigner,
    policies: [toSudoPolicy({})],
  });
  
  // Attempt 1: Using deployedAccountAddress
  console.log('\nAttempt 1: Using deployedAccountAddress parameter');
  const attempt1Account = await createKernelAccount(publicClient, {
    deployedAccountAddress: originalAccount.address,
    plugins: {
      regular: permissionPlugin,
    },
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });
  
  console.log('Result:', attempt1Account.address);
  console.log('Match original?', attempt1Account.address === originalAccount.address);
  
  // Attempt 2: Using same sudo plugin
  console.log('\nAttempt 2: Using both sudo and regular plugins');
  const attempt2Account = await createKernelAccount(publicClient, {
    deployedAccountAddress: originalAccount.address,
    plugins: {
      sudo: ecdsaValidator,
      regular: permissionPlugin,
    },
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });
  
  console.log('Result:', attempt2Account.address);
  console.log('Match original?', attempt2Account.address === originalAccount.address);
  
  // Attempt 3: Check if it's the validator that determines address
  console.log('\nAttempt 3: Same validator, different signer');
  const newOwnerPrivateKey = generatePrivateKey();
  const newOwner = privateKeyToAccount(newOwnerPrivateKey);
  
  const newEcdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: newOwner,
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });
  
  const attempt3Account = await createKernelAccount(publicClient, {
    plugins: {
      sudo: newEcdsaValidator,
    },
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });
  
  console.log('Result:', attempt3Account.address);
  console.log('Different from original?', attempt3Account.address !== originalAccount.address);
  
  // Key insight
  console.log('\n📊 Analysis:');
  console.log('- Kernel accounts are deterministically generated based on:');
  console.log('  1. The validator module address');
  console.log('  2. The validator initialization data (includes the signer)');
  console.log('  3. The kernel version and entry point');
  console.log('- deployedAccountAddress parameter seems to be for already deployed accounts');
  console.log('- To maintain the same address, you must use the exact same validator configuration');
  
  // Solution
  console.log('\n💡 Solution for DCA:');
  console.log('1. Store the original validator configuration when creating the wallet');
  console.log('2. When creating session keys, install them as additional plugins');
  console.log('3. Use the original account instance, not create a new one');
  console.log('4. Or use the "agent key" approach where the server holds keys to the original wallet');
}

// Run the diagnosis
if (import.meta.main) {
  diagnoseAddressMismatch().catch(console.error);
}

export { diagnoseAddressMismatch };