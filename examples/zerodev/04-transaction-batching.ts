/**
 * EIP-7702 Transaction Batching
 * Demonstrates how to batch multiple transactions in a single user operation
 */

import { encodeFunctionData } from 'viem';

export async function batchTransactions(
  kernelAccountClient: any,
  ZERODEV_TOKEN_ADDRESS: string,
  transferAbi: any,
  recipientAddress: string,
  amount: bigint
) {
  // Execute batched transactions
  const userOpHash = await kernelAccountClient.sendUserOperation({
    calls: [
      {
        to: ZERODEV_TOKEN_ADDRESS,
        value: BigInt(0),
        data: encodeFunctionData({
          abi: transferAbi,
          functionName: 'transfer',
          args: [recipientAddress, amount],
        }),
      },
      // Add more calls to batch additional transactions
      {
        to: ZERODEV_TOKEN_ADDRESS,
        value: BigInt(0),
        data: encodeFunctionData({
          abi: transferAbi,
          functionName: 'approve',
          args: [recipientAddress, amount],
        }),
      },
    ],
  });

  console.log('Batched transaction hash:', userOpHash);
  return userOpHash;
}
