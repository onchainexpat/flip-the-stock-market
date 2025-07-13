import 'dotenv/config';
import { KERNEL_V3_1 } from '@zerodev/sdk/constants';
import { zeroAddress } from 'viem';
import { getKernelClient } from '../utils';

async function main() {
  const kernelClient = await getKernelClient('0.7', KERNEL_V3_1);

  console.log('Account address:', kernelClient.account.address);

  const txnHash = await kernelClient.sendTransaction({
    calls: [
      {
        to: zeroAddress,
        value: BigInt(0),
        data: '0x',
      },
      {
        to: zeroAddress,
        value: BigInt(0),
        data: '0x',
      },
    ],
  });

  console.log('Txn hash:', txnHash);
}

main();
