import 'dotenv/config';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { toPermissionValidator } from '@zerodev/permissions';
import { toSudoPolicy } from '@zerodev/permissions/policies';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { RemoteSignerMode, toRemoteSigner } from '@zerodev/remote-signer';
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import { http, Hex, createPublicClient, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

if (
  !process.env.ZERODEV_RPC ||
  !process.env.PRIVATE_KEY ||
  !process.env.ZERODEV_API_KEY
) {
  throw new Error('ZERODEV_RPC or PRIVATE_KEY or ZERODEV_API_KEY is not set');
}
const chain = sepolia;
const publicClient = createPublicClient({
  transport: http(process.env.ZERODEV_RPC),
  chain,
});

const signer = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);

const entryPoint = getEntryPoint('0.7');
const apiKey = process.env.ZERODEV_API_KEY;

const main = async () => {
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer,
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });

  // first we create the remote signer in create mode
  const remoteSigner = await toRemoteSigner({
    apiKey,
    mode: RemoteSignerMode.Create,
  });

  // now we get the ecdsa signer using the remote signer
  const ecdsaSigner = await toECDSASigner({ signer: remoteSigner });

  const permissionPlugin = await toPermissionValidator(publicClient, {
    entryPoint,
    signer: ecdsaSigner,
    policies: [toSudoPolicy({})],
    kernelVersion: KERNEL_V3_1,
  });

  const account = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
      regular: permissionPlugin,
    },
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });
  console.log('My account:', account.address);

  const paymasterClient = createZeroDevPaymasterClient({
    chain,
    transport: http(process.env.ZERODEV_RPC),
  });

  const kernelClient = createKernelAccountClient({
    account,
    chain,
    bundlerTransport: http(process.env.ZERODEV_RPC),
    paymaster: {
      getPaymasterData(userOperation) {
        return paymasterClient.sponsorUserOperation({ userOperation });
      },
    },
  });

  const txHash = await kernelClient.sendTransaction({
    to: zeroAddress,
    value: BigInt(0),
    data: '0x',
  });

  console.log('txHash hash:', txHash);

  // now we get the remote signer in get mode
  const remoteSignerWithGet = await toRemoteSigner({
    apiKey,
    keyAddress: remoteSigner.address, // specify the account address to get
    mode: RemoteSignerMode.Get,
  });

  const ecdsaSigner2 = await toECDSASigner({ signer: remoteSignerWithGet });

  const permissionPlugin2 = await toPermissionValidator(publicClient, {
    entryPoint,
    signer: ecdsaSigner2,
    policies: [toSudoPolicy({})],
    kernelVersion: KERNEL_V3_1,
  });

  const account2 = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
      regular: permissionPlugin2,
    },
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });

  console.log('My account2:', account2.address);

  const kernelClient2 = createKernelAccountClient({
    account: account2,
    chain,
    bundlerTransport: http(process.env.ZERODEV_RPC),
    paymaster: {
      getPaymasterData(userOperation) {
        return paymasterClient.sponsorUserOperation({ userOperation });
      },
    },
  });

  const txHash2 = await kernelClient2.sendTransaction({
    to: zeroAddress,
    value: BigInt(0),
    data: '0x',
  });

  console.log('txHash hash:', txHash2);
};

main();
