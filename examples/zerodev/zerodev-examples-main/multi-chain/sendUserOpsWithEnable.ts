import {
  prepareAndSignUserOperations,
  toMultiChainECDSAValidator,
} from '@zerodev/multi-chain-ecdsa-validator';
import { toPermissionValidator } from '@zerodev/permissions';
import { toSudoPolicy } from '@zerodev/permissions/policies';
import { toECDSASigner } from '@zerodev/permissions/signers';
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import dotenv from 'dotenv';
import {
  http,
  type Chain,
  type Client,
  type Hex,
  type Transport,
  createPublicClient,
  zeroAddress,
} from 'viem';
import type { SmartAccount } from 'viem/account-abstraction';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { optimismSepolia, sepolia } from 'viem/chains';

dotenv.config();

if (
  !process.env.PRIVATE_KEY ||
  !process.env.RPC_URL ||
  !process.env.OPTIMISM_SEPOLIA_RPC_URL ||
  !process.env.ZERODEV_RPC ||
  !process.env.OPTIMISM_SEPOLIA_ZERODEV_RPC
) {
  console.error(
    'Please set PRIVATE_KEY, RPC_URL, OPTIMISM_SEPOLIA_RPC_URL, ZERODEV_RPC, OPTIMISM_SEPOLIA_ZERODEV_RPC',
  );
  process.exit(1);
}

const PRIVATE_KEY = process.env.PRIVATE_KEY;

const SEPOLIA_RPC_URL = process.env.RPC_URL;
const OPTIMISM_SEPOLIA_RPC_URL = process.env.OPTIMISM_SEPOLIA_RPC_URL;

const SEPOLIA_ZERODEV_RPC_URL = process.env.ZERODEV_RPC;
const OPTIMISM_SEPOLIA_ZERODEV_RPC_URL =
  process.env.OPTIMISM_SEPOLIA_ZERODEV_RPC;

const entryPoint = getEntryPoint('0.7');

const main = async () => {
  const sepoliaPublicClient = createPublicClient({
    transport: http(SEPOLIA_RPC_URL),
    chain: sepolia,
  });
  const optimismSepoliaPublicClient = createPublicClient({
    transport: http(OPTIMISM_SEPOLIA_RPC_URL),
    chain: optimismSepolia,
  });

  const signer = privateKeyToAccount(PRIVATE_KEY as Hex);
  const sepoliaMultiSigECDSAValidatorPlugin = await toMultiChainECDSAValidator(
    sepoliaPublicClient,
    {
      entryPoint,
      signer,
      kernelVersion: KERNEL_V3_1,
    },
  );
  const optimismSepoliaMultiSigECDSAValidatorPlugin =
    await toMultiChainECDSAValidator(optimismSepoliaPublicClient, {
      entryPoint,
      signer,
      kernelVersion: KERNEL_V3_1,
    });

  const sepoliaEcdsaSigner = privateKeyToAccount(generatePrivateKey());
  const sepoliaEcdsaModularSigner = await toECDSASigner({
    signer: sepoliaEcdsaSigner,
  });

  const optimismSepoliaEcdsaSigner = privateKeyToAccount(generatePrivateKey());
  const optimismSepoliaEcdsaModularSigner = await toECDSASigner({
    signer: optimismSepoliaEcdsaSigner,
  });

  const sudoPolicy = toSudoPolicy({});

  const sepoliaPermissionPlugin = await toPermissionValidator(
    sepoliaPublicClient,
    {
      entryPoint,
      signer: sepoliaEcdsaModularSigner,
      policies: [sudoPolicy],
      kernelVersion: KERNEL_V3_1,
    },
  );

  const optimismSepoliaPermissionPlugin = await toPermissionValidator(
    optimismSepoliaPublicClient,
    {
      entryPoint,
      signer: optimismSepoliaEcdsaModularSigner,
      policies: [sudoPolicy],
      kernelVersion: KERNEL_V3_1,
    },
  );

  const sepoliaKernelAccount = await createKernelAccount(sepoliaPublicClient, {
    entryPoint,
    plugins: {
      sudo: sepoliaMultiSigECDSAValidatorPlugin,
      regular: sepoliaPermissionPlugin,
    },
    kernelVersion: KERNEL_V3_1,
  });

  const optimismSepoliaKernelAccount = await createKernelAccount(
    optimismSepoliaPublicClient,
    {
      entryPoint,
      plugins: {
        sudo: optimismSepoliaMultiSigECDSAValidatorPlugin,
        regular: optimismSepoliaPermissionPlugin,
      },
      kernelVersion: KERNEL_V3_1,
    },
  );

  console.log('sepoliaKernelAccount.address', sepoliaKernelAccount.address);
  console.log(
    'optimismSepoliaKernelAccount.address',
    optimismSepoliaKernelAccount.address,
  );

  const sepoliaZeroDevPaymasterClient = createZeroDevPaymasterClient({
    chain: sepolia,
    transport: http(SEPOLIA_ZERODEV_RPC_URL),
  });

  const opSepoliaZeroDevPaymasterClient = createZeroDevPaymasterClient({
    chain: optimismSepolia,
    transport: http(OPTIMISM_SEPOLIA_ZERODEV_RPC_URL),
  });

  const sepoliaZerodevKernelClient = createKernelAccountClient({
    account: sepoliaKernelAccount,
    chain: sepolia,
    bundlerTransport: http(SEPOLIA_ZERODEV_RPC_URL),
    paymaster: {
      getPaymasterData(userOperation) {
        return sepoliaZeroDevPaymasterClient.sponsorUserOperation({
          userOperation,
        });
      },
    },
  });

  const optimismSepoliaZerodevKernelClient = createKernelAccountClient({
    account: optimismSepoliaKernelAccount,
    chain: optimismSepolia,
    bundlerTransport: http(OPTIMISM_SEPOLIA_ZERODEV_RPC_URL),
    paymaster: {
      getPaymasterData(userOperation) {
        return opSepoliaZeroDevPaymasterClient.sponsorUserOperation({
          userOperation,
        });
      },
    },
  });

  const clients: Client<Transport, Chain, SmartAccount>[] = [
    {
      ...sepoliaZerodevKernelClient,
    },
    {
      ...optimismSepoliaZerodevKernelClient,
    },
  ];

  const userOps = await Promise.all(
    clients.map(async (client) => {
      return {
        callData: await client.account.encodeCalls([
          {
            to: zeroAddress,
            value: BigInt(0),
            data: '0x',
          },
        ]),
      };
    }),
  );

  const userOpParams = [
    {
      ...userOps[0],
      chainId: sepolia.id,
    },
    {
      ...userOps[1],
      chainId: optimismSepolia.id,
    },
  ];

  // prepare and sign user operations with multi-chain ecdsa validator
  const signedUserOps = await prepareAndSignUserOperations(
    clients,
    userOpParams,
  );
  const sepoliaUserOp = signedUserOps[0];
  const optimismSepoliaUserOp = signedUserOps[1];

  console.log('sending sepoliaUserOp');
  const sepoliaUserOpHash =
    await sepoliaZerodevKernelClient.sendUserOperation(sepoliaUserOp);

  console.log('sepoliaUserOpHash', sepoliaUserOpHash);
  await sepoliaZerodevKernelClient.waitForUserOperationReceipt({
    hash: sepoliaUserOpHash,
  });

  console.log('sending optimismSepoliaUserOp');
  const optimismSepoliaUserOpHash =
    await optimismSepoliaZerodevKernelClient.sendUserOperation(
      optimismSepoliaUserOp,
    );

  console.log('optimismSepoliaUserOpHash', optimismSepoliaUserOpHash);
  await optimismSepoliaZerodevKernelClient.waitForUserOperationReceipt({
    hash: optimismSepoliaUserOpHash,
  });

  // now you can use sendTransaction or sendUserOperation since you've already enabled the regular validator, which is permission here.
  const sepoliaTxHash = await sepoliaZerodevKernelClient.sendTransaction({
    to: zeroAddress,
    value: BigInt(0),
    data: '0x',
  });
  console.log('sepoliaTxHash', sepoliaTxHash);

  const optimismSepoliaTxHash =
    await optimismSepoliaZerodevKernelClient.sendTransaction({
      to: zeroAddress,
      value: BigInt(0),
      data: '0x',
    });
  console.log('optimismSepoliaTxHash', optimismSepoliaTxHash);
};

main();
