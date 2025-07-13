import {
  INTENT_V0_4,
  createIntentClient,
  installIntentExecutor,
} from '@zerodev/intent';
import { toMultiChainECDSAValidator } from '@zerodev/multi-chain-ecdsa-validator';
import { createKernelAccount } from '@zerodev/sdk';
import { KERNEL_V3_2, getEntryPoint } from '@zerodev/sdk/constants';
import dotenv from 'dotenv';
import {
  http,
  type Chain,
  type Hex,
  createPublicClient,
  parseUnits,
  zeroAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, optimism } from 'viem/chains';

dotenv.config();

if (!process.env.PRIVATE_KEY || !process.env.ZERODEV_RPC) {
  throw new Error('PRIVATE_KEY or ZERODEV_RPC is not set');
}

const timeout = 100_000;
const privateKey = process.env.PRIVATE_KEY as Hex;
const account = privateKeyToAccount(privateKey);

const intentVersion = INTENT_V0_4;

const zerodevRpc = process.env.ZERODEV_RPC as string;

const publicClient = createPublicClient({
  chain: optimism,
  transport: http(),
});

async function createIntentClinet(chain: Chain) {
  // set kernel and entryPoint version
  const entryPoint = getEntryPoint('0.7');
  const kernelVersion = KERNEL_V3_2;

  // create ecdsa validator
  const ecdsaValidator = await toMultiChainECDSAValidator(publicClient, {
    signer: account,
    kernelVersion,
    entryPoint,
  });

  const kernelAccount = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    kernelVersion,
    entryPoint,
    initConfig: [installIntentExecutor(intentVersion)],
  });

  // the cabclient can be used to send normal userOp and cross-chain cab tx
  const intentClient = createIntentClient({
    account: kernelAccount,
    chain,
    bundlerTransport: http(zerodevRpc, { timeout }),
    version: intentVersion,
  });

  return intentClient;
}

async function main() {
  const intentClient = await createIntentClinet(optimism);
  console.log('account', intentClient.account.address);

  const result = await intentClient.estimateUserIntentFees({
    calls: [
      {
        to: zeroAddress,
        value: BigInt(0),
        data: '0x',
      },
    ],
    outputTokens: [
      {
        chainId: base.id,
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on base
        amount: parseUnits('100', 6), // 100 USDC
      },
    ],
  });
  console.log('Intent fee estimation', result);

  process.exit(0);
}
main();
