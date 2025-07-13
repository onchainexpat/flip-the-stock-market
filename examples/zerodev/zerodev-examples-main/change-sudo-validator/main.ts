import 'dotenv/config';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { toMultiChainECDSAValidator } from '@zerodev/multi-chain-ecdsa-validator';
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import { http, Hex, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

if (!process.env.ZERODEV_RPC || !process.env.PRIVATE_KEY) {
  throw new Error('ZERODEV_RPC or PRIVATE_KEY is not set');
}

const chain = sepolia;
const publicClient = createPublicClient({
  transport: http(process.env.ZERODEV_RPC),
  chain,
});

const signer = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);
const entryPoint = getEntryPoint('0.7');
const kernelVersion = KERNEL_V3_1;

const main = async () => {
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
  console.log('My account:', account.address);
  const paymaster = createZeroDevPaymasterClient({
    chain,
    transport: http(process.env.ZERODEV_RPC),
  });

  const kernelClient = createKernelAccountClient({
    account,
    chain,
    bundlerTransport: http(process.env.ZERODEV_RPC),
    paymaster: {
      getPaymasterData(userOperation) {
        return paymaster.sponsorUserOperation({ userOperation });
      },
    },
  });

  // initialize multiChainECDSAValidatorPlugin
  const multiChainECDSAValidatorPlugin = await toMultiChainECDSAValidator(
    publicClient,
    {
      entryPoint,
      kernelVersion,
      signer,
    }
  );

  /**
   * @dev In this example, we initialize kernel with ecdsaValidator as sudoValidator and then change it to multiChainECDSAValidatorPlugin. But in most cases, these are separate actions since you would want to change sudoValidator to a different one after deploying the kernel.
   */
  const changeSudoValidatorUserOpHash = await kernelClient.changeSudoValidator({
    sudoValidator: multiChainECDSAValidatorPlugin,
  });

  console.log(
    'changeSudoValidatorUserOpHash hash:',
    changeSudoValidatorUserOpHash
  );

  const _receipt = await kernelClient.waitForUserOperationReceipt({
    hash: changeSudoValidatorUserOpHash,
  });

  console.log('userOp completed');

  // after this, now you can use multiChainECDSAValidatorPlugin as sudoValidator. For usage of the multi-chain ecdsa validator, refer to the example in `multi-chain` directory. For the multi-chain webauthn validator, refer to this [repo](https://github.com/zerodevapp/multi-chain-passkey-example)
};

main();
