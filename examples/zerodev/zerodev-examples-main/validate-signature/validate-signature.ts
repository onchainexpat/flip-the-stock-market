import 'dotenv/config';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { createKernelAccount, verifyEIP6492Signature } from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import { http, Hex, createPublicClient, hashMessage } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const entryPoint = getEntryPoint('0.7');

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey || !process.env.ZERODEV_RPC) {
  throw new Error('PRIVATE_KEY or ZERODEV_RPC is not set');
}

const signer = privateKeyToAccount(privateKey as Hex);

const kernelVersion = KERNEL_V3_1;

const publicClient = createPublicClient({
  transport: http(process.env.ZERODEV_RPC),
});

async function main() {
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer,
    entryPoint,
    kernelVersion,
  });

  const account = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    entryPoint,
    kernelVersion,
  });

  console.log('Account address:', account.address);

  const signature = await account.signMessage({
    message: 'hello world',
  });

  console.log(
    await verifyEIP6492Signature({
      signer: account.address, // your smart account address
      hash: hashMessage('hello world'),
      signature: signature,
      client: publicClient,
    })
  );
}

main();
