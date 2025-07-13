import 'dotenv/config';
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { getUserOperationGasPrice } from '@zerodev/sdk/actions';
import { KERNEL_V3_3, getEntryPoint } from '@zerodev/sdk/constants';
import { http, Hex, createPublicClient, zeroAddress } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

if (!process.env['ZERODEV_RPC']) {
  throw new Error('ZERODEV_RPC is not set');
}

const entryPoint = getEntryPoint('0.7');
const kernelVersion = KERNEL_V3_3;

// We use the Sepolia testnet here, but you can use any network that
// supports EIP-7702.
const chain = sepolia;
const ZERODEV_RPC = process.env['ZERODEV_RPC'];

const publicClient = createPublicClient({
  transport: http(),
  chain,
});

const main = async () => {
  const eip7702Account = privateKeyToAccount(
    generatePrivateKey() ?? (process.env['PRIVATE_KEY'] as Hex)
  );
  console.log('EOA Address:', eip7702Account.address);

  const account = await createKernelAccount(publicClient, {
    eip7702Account,
    entryPoint,
    kernelVersion,
  });
  console.log('account', account.address);

  const paymasterClient = createZeroDevPaymasterClient({
    chain,
    transport: http(ZERODEV_RPC),
  });

  const kernelClient = createKernelAccountClient({
    account,
    chain,
    bundlerTransport: http(ZERODEV_RPC),
    paymaster: {
      getPaymasterData: async (userOperation) => {
        return paymasterClient.sponsorUserOperation({ userOperation });
      },
    },
    client: publicClient,
    userOperation: {
      estimateFeesPerGas: async ({ bundlerClient }) => {
        return getUserOperationGasPrice(bundlerClient);
      },
    },
  });

  const userOpHash = await kernelClient.sendUserOperation({
    callData: await kernelClient.account.encodeCalls([
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
    ]),
  });
  console.log('UserOp sent:', userOpHash);
  console.log('Waiting for UserOp to be completed...');

  const { receipt } = await kernelClient.waitForUserOperationReceipt({
    hash: userOpHash,
  });
  console.log(
    'UserOp completed',
    `${chain.blockExplorers.default.url}/tx/${receipt.transactionHash}`
  );

  process.exit(0);
};

main();
