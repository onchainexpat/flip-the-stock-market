import 'dotenv/config';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { toSpendingLimitHook } from '@zerodev/hooks';
import { toPermissionValidator } from '@zerodev/permissions';
import { toSudoPolicy } from '@zerodev/permissions/policies';
import { toECDSASigner } from '@zerodev/permissions/signers';
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import { http, createPublicClient, encodeFunctionData } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { TEST_ERC20Abi } from './Test_ERC20abi';

if (!process.env.ZERODEV_RPC || !process.env.PRIVATE_KEY) {
  throw new Error('ZERODEV_RPC or PRIVATE_KEY is not set');
}
const chain = sepolia;
const publicClient = createPublicClient({
  transport: http(process.env.ZERODEV_RPC),
  chain,
});

const signer = privateKeyToAccount(generatePrivateKey());

const entryPoint = getEntryPoint('0.7');

const Test_ERC20Address = '0x3870419Ba2BBf0127060bCB37f69A1b1C090992B';

const main = async () => {
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer,
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });

  const ecdsaSigner = await toECDSASigner({
    signer: privateKeyToAccount(generatePrivateKey()),
  });

  const sudoPolicy = await toSudoPolicy({});

  const permissoinPlugin = await toPermissionValidator(publicClient, {
    signer: ecdsaSigner,
    policies: [sudoPolicy],
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });

  const spendingLimitHook = await toSpendingLimitHook({
    limits: [{ token: Test_ERC20Address, allowance: BigInt(4337) }],
  });

  const kernelAccount = await createKernelAccount(publicClient, {
    entryPoint,
    plugins: {
      sudo: ecdsaValidator,
      regular: permissoinPlugin,
      hook: spendingLimitHook,
    },
    kernelVersion: KERNEL_V3_1,
  });
  const paymaster = createZeroDevPaymasterClient({
    chain: chain,
    transport: http(process.env.ZERODEV_RPC),
  });

  const kernelClient = await createKernelAccountClient({
    account: kernelAccount,
    chain,
    bundlerTransport: http(process.env.ZERODEV_RPC),
    paymaster: {
      getPaymasterData(userOperation) {
        return paymaster.sponsorUserOperation({ userOperation });
      },
    },
  });

  const amountToMint = BigInt(10000);

  const mintData = encodeFunctionData({
    abi: TEST_ERC20Abi,
    functionName: 'mint',
    args: [kernelAccount.address, amountToMint],
  });

  const mintTransactionHash = await kernelClient.sendTransaction({
    to: Test_ERC20Address,
    data: mintData,
  });

  console.log('Mint transaction hash:', mintTransactionHash);

  const amountToTransfer = BigInt(4337);
  const transferData = encodeFunctionData({
    abi: TEST_ERC20Abi,
    functionName: 'transfer',
    args: [signer.address, amountToTransfer],
  });

  const response = await kernelClient.sendTransaction({
    to: Test_ERC20Address,
    data: transferData,
  });

  console.log('Transfer transaction hash:', response);

  const transferDataWillFail = encodeFunctionData({
    abi: TEST_ERC20Abi,
    functionName: 'transfer',
    args: [signer.address, BigInt(1)],
  });

  try {
    await kernelClient.sendTransaction({
      to: Test_ERC20Address,
      data: transferDataWillFail,
    });
  } catch (error) {
    console.log('Transfer failed as expected');
  }
};

main();
