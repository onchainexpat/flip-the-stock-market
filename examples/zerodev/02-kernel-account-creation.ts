/**
 * EIP-7702 Kernel Account Creation
 * Creates a kernel account with EIP-7702 authorization
 */

import { createKernelAccount } from '@zerodev/sdk';
import {
  KERNEL_V3_1,
  KernelVersionToAddressesMap,
} from '@zerodev/sdk/constants';
import { http, createPublicClient } from 'viem';
import { baseSepolia } from 'viem/chains';

export async function createEIP7702KernelAccount(
  account: any,
  entryPoint: any
) {
  // Set kernel version and get addresses
  const kernelVersion = KERNEL_V3_1;
  const kernelAddresses = KernelVersionToAddressesMap[kernelVersion];

  // Generate new private key and account (commented out as not used in this example)
  // const newPrivateKey = generatePrivateKey();
  // const newAccount = privateKeyToAccount(newPrivateKey);

  // Create public client
  const baseSepoliaPublicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  // Sign EIP-7702 authorization
  const authorization = await account.signAuthorization({
    chainId: baseSepolia.id,
    nonce: 0,
    address: kernelAddresses.accountImplementationAddress,
  });

  // Create kernel account with EIP-7702 auth
  const kernelAccount = await createKernelAccount(baseSepoliaPublicClient, {
    eip7702Account: account,
    entryPoint,
    kernelVersion,
    eip7702Auth: authorization,
  });

  return kernelAccount;
}
