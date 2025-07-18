/**
 * Complete EIP-7702 Integration Example
 * Full implementation showing all components working together
 */

import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import {
  KERNEL_V3_1,
  KernelVersionToAddressesMap,
} from '@zerodev/sdk/constants';
import { http, encodeFunctionData } from 'viem';
import { baseSepolia } from 'viem/chains';

export class EIP7702Integration {
  private kernelAccount: any;
  private kernelAccountClient: any;
  private paymasterClient: any;

  constructor(
    private baseSepoliaPaymasterRpc: string,
    private baseSepoliaBundlerRpc: string,
    private publicClient: any,
  ) {}

  async initialize(account: any, entryPoint: any) {
    // Step 1: Create kernel account
    const kernelVersion = KERNEL_V3_1;
    const kernelAddresses = KernelVersionToAddressesMap[kernelVersion];

    const authorization = await account.signAuthorization({
      chainId: baseSepolia.id,
      nonce: 0,
      address: kernelAddresses.accountImplementationAddress,
    });

    this.kernelAccount = await createKernelAccount(this.publicClient, {
      eip7702Account: account,
      entryPoint,
      kernelVersion,
      eip7702Auth: authorization,
    });

    // Step 2: Setup paymaster
    this.paymasterClient = createZeroDevPaymasterClient({
      chain: baseSepolia,
      transport: http(this.baseSepoliaPaymasterRpc),
    });

    // Step 3: Create account client
    this.kernelAccountClient = createKernelAccountClient({
      paymaster: this.paymasterClient,
      bundlerTransport: http(this.baseSepoliaBundlerRpc),
      account: this.kernelAccount,
      chain: baseSepolia,
      client: this.publicClient,
    });

    console.log('EIP-7702 integration initialized successfully');
  }

  async executeTransaction(calls: any[]) {
    if (!this.kernelAccountClient) {
      throw new Error('Integration not initialized. Call initialize() first.');
    }

    const userOpHash = await this.kernelAccountClient.sendUserOperation({
      calls,
    });

    console.log('Transaction executed:', userOpHash);
    return userOpHash;
  }

  async batchTransfer(
    tokenAddress: string,
    transfers: Array<{ to: string; amount: bigint }>,
  ) {
    const calls = transfers.map((transfer) => ({
      to: tokenAddress,
      value: BigInt(0),
      data: encodeFunctionData({
        abi: [
          {
            name: 'transfer',
            type: 'function',
            inputs: [
              { name: 'to', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            outputs: [{ name: '', type: 'bool' }],
          },
        ],
        functionName: 'transfer',
        args: [transfer.to, transfer.amount],
      }),
    }));

    return this.executeTransaction(calls);
  }
}
