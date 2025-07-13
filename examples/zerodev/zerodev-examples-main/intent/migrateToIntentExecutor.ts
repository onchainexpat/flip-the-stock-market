import 'dotenv/config';
import { INTENT_V0_4, createIntentClient } from '@zerodev/intent';
import { getIntentExecutorPluginData } from '@zerodev/intent';
import { toMultiChainECDSAValidator } from '@zerodev/multi-chain-ecdsa-validator';
import {
  createKernelAccount,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { KERNEL_V3_2, getEntryPoint } from '@zerodev/sdk/constants';
import dotenv from 'dotenv';
import {
  http,
  type Chain,
  type Hex,
  createPublicClient,
  zeroAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

dotenv.config();

if (!process.env.PRIVATE_KEY || !process.env.ZERODEV_RPC) {
  throw new Error('PRIVATE_KEY or ZERODEV_RPC is not set');
}

const timeout = 100_000;
const privateKey = process.env.PRIVATE_KEY as Hex;
const account = privateKeyToAccount(privateKey);

const chain = sepolia;
const zerodevRpc = process.env.ZERODEV_RPC as string;
const publicClient = createPublicClient({
  chain,
  transport: http(),
});

async function getIntentClient(chain: Chain) {
  // set kernel and entryPoint version
  const entryPoint = getEntryPoint('0.7');
  const kernelVersion = KERNEL_V3_2;

  // create ecdsa validator
  const ecdsaValidator = await toMultiChainECDSAValidator(publicClient, {
    signer: account,
    kernelVersion,
    entryPoint,
  });

  //
  const kernelAccount = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    kernelVersion,
    entryPoint,
    pluginMigrations: [getIntentExecutorPluginData(INTENT_V0_4)],
  });

  const paymasterClient = createZeroDevPaymasterClient({
    chain,
    transport: http(zerodevRpc, { timeout }),
  });

  const intentClient = createIntentClient({
    account: kernelAccount,
    chain,
    bundlerTransport: http(zerodevRpc, { timeout }),
    paymaster: {
      getPaymasterData: async (userOperation) => {
        return await paymasterClient.sponsorUserOperation({
          userOperation,
        });
      },
    },
    version: INTENT_V0_4,
  });
  return intentClient;
}

async function main() {
  const intentClient = await getIntentClient(chain);

  const uoHash = await intentClient.sendUserOperation({
    callData: await intentClient.account.encodeCalls([
      {
        to: zeroAddress,
        value: BigInt(0),
        data: '0x',
      },
    ]),
  });
  console.log('uoHash', uoHash);

  const receipt = await intentClient.waitForUserOperationReceipt({
    hash: uoHash,
  });

  console.log(receipt.receipt.transactionHash);

  process.exit(0);
}
main();
