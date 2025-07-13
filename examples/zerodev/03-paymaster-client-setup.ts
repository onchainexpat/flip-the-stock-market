/**
 * EIP-7702 Paymaster Client Setup
 * Configures gas sponsorship with a paymaster client
 */

import {
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { http } from 'viem';
import { baseSepolia } from 'viem/chains';

export async function setupPaymasterClient(
  kernelAccount: any,
  baseSepoliaPaymasterRpc: string,
  baseSepoliaBundlerRpc: string,
  baseSepoliaPublicClient: any
) {
  // Create paymaster client for gas sponsorship
  const paymasterClient = createZeroDevPaymasterClient({
    chain: baseSepolia,
    transport: http(baseSepoliaPaymasterRpc),
  });

  // Create kernel account client with paymaster
  const kernelAccountClient = createKernelAccountClient({
    paymaster: paymasterClient,
    bundlerTransport: http(baseSepoliaBundlerRpc),
    account: kernelAccount,
    chain: baseSepolia,
    client: baseSepoliaPublicClient,
  });

  return {
    paymasterClient,
    kernelAccountClient,
  };
}
