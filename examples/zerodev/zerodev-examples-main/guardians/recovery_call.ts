import 'dotenv/config';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  AccountNotFoundError,
  type KernelValidator,
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import {
  http,
  type Address,
  type Hex,
  concat,
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
  parseAbi,
  parseAbiParameters,
  toFunctionSelector,
  zeroAddress,
} from 'viem';
import type { Chain, Client, Hash, Prettify, Transport } from 'viem';
import { type SmartAccount, sendUserOperation } from 'viem/account-abstraction';
import {
  generatePrivateKey,
  parseAccount,
  privateKeyToAccount,
} from 'viem/accounts';
import { lineaSepolia } from 'viem/chains';
import { getAction } from 'viem/utils';

if (!process.env.ZERODEV_RPC || !process.env.PRIVATE_KEY) {
  throw new Error('ZERODEV_RPC or PRIVATE_KEY is not set');
}

const publicClient = createPublicClient({
  transport: http(process.env.ZERODEV_RPC),
  chain: lineaSepolia,
});

const CALLER_HOOK = '0x990a9FC8189D96d59E3cE98bd87F42135a24a30E';
const RECOVERY_ACTION_ADDRESS = '0xe884C2868CC82c16177eC73a93f7D9E6F3A5DC6E';
const ACTION_MODULE_TYPE = 3;
const oldSigner = privateKeyToAccount(generatePrivateKey());
const newSigner = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);

const entryPoint = getEntryPoint('0.7');
const recoveryExecutorFunction =
  'function doRecovery(address _validator, bytes calldata _data)';

const installModuleFunction =
  'function installModule(uint256 _type, address _module, bytes calldata _initData)';

type RegisterGuardianParameters = {
  guardian: Address;
  account?: SmartAccount;
};

export async function registerGuardian<
  account extends SmartAccount | undefined,
  chain extends Chain | undefined,
>(
  client: Client<Transport, chain, account>,
  args: Prettify<RegisterGuardianParameters>,
): Promise<Hash> {
  const { guardian, account: account_ = client.account } = args;
  if (!account_) throw new AccountNotFoundError();

  const account = parseAccount(account_) as SmartAccount;

  return await getAction(
    client,
    sendUserOperation,
    'sendUserOperation',
  )({
    account,
    callData: encodeFunctionData({
      abi: parseAbi([installModuleFunction]),
      functionName: 'installModule',
      args: [
        BigInt(ACTION_MODULE_TYPE),
        RECOVERY_ACTION_ADDRESS,
        concat([
          toFunctionSelector(
            parseAbi([recoveryExecutorFunction])[0],
          ) as `0x${string}`,
          CALLER_HOOK as `0x${string}`,
          encodeAbiParameters(
            parseAbiParameters('bytes selectorData, bytes hookData'),
            [
              '0xff' as `0x${string}`, // selectorData, use delegatecall
              concat([
                '0xff', // flag to install hook
                encodeAbiParameters(parseAbiParameters('address[] guardians'), [
                  [guardian],
                ]),
              ]),
            ],
          ),
        ]),
      ],
    }),
  });
}

type RecoveryParameters = {
  targetAccount: Address;
  guardian: SmartAccount;
  newSigner: KernelValidator;
};

export async function recoverAccount<
  account extends SmartAccount | undefined,
  chain extends Chain | undefined,
>(
  client: Client<Transport, chain, account>,
  args: Prettify<RecoveryParameters>,
) {
  const { targetAccount, guardian, newSigner } = args;

  return await getAction(
    client,
    sendUserOperation,
    'sendUserOperation',
  )({
    account: guardian,
    calls: [
      {
        to: targetAccount,
        data: encodeFunctionData({
          abi: parseAbi([recoveryExecutorFunction]),
          functionName: 'doRecovery',
          args: [newSigner.address, await newSigner.getEnableData()],
        }),
      },
    ],
    callGasLimit: BigInt(1000000),
  });
}

const main = async () => {
  const paymasterClient = createZeroDevPaymasterClient({
    chain: lineaSepolia,
    transport: http(process.env.ZERODEV_RPC),
  });

  // ---- set up target account ----
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: oldSigner,
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });

  const targetAccount = await createKernelAccount(publicClient, {
    entryPoint,
    plugins: {
      sudo: ecdsaValidator,
    },
    kernelVersion: KERNEL_V3_1,
  });
  console.log('target account created:', targetAccount.address);

  // ---- set up guardian account ----
  const guardian = privateKeyToAccount(generatePrivateKey());
  const guardianValidator = await signerToEcdsaValidator(publicClient, {
    signer: guardian,
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });

  const guardianAccount = await createKernelAccount(publicClient, {
    entryPoint,
    plugins: {
      sudo: guardianValidator,
    },
    kernelVersion: KERNEL_V3_1,
  });
  console.log('guardian account created:', guardianAccount.address);

  // ---- set up new signer ----
  const newEcdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: newSigner,
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });

  // ---- install recovery action with caller Hook ----
  const targetClient = createKernelAccountClient({
    account: targetAccount,
    chain: lineaSepolia,
    bundlerTransport: http(process.env.ZERODEV_RPC),
    paymaster: {
      getPaymasterData(userOperation) {
        return paymasterClient.sponsorUserOperation({ userOperation });
      },
    },
  });

  console.log('installing recovery action with caller hook...');

  await registerGuardian(targetClient, {
    guardian: guardianAccount.address,
    account: targetAccount,
  });

  // ---- perform recovery ----
  console.log('performing recovery...');
  const guardianClient = createKernelAccountClient({
    account: guardianAccount,
    chain: lineaSepolia,
    bundlerTransport: http(process.env.ZERODEV_RPC),
    paymaster: paymasterClient,
  });

  const userOpHash = await recoverAccount(guardianClient, {
    targetAccount: targetAccount.address,
    guardian: guardianAccount,
    newSigner: newEcdsaValidator,
  });

  console.log('recovery userOp hash:', userOpHash);
  await guardianClient.waitForUserOperationReceipt({
    hash: userOpHash,
  });

  console.log('recovery completed!');

  const newAccount = await createKernelAccount(publicClient, {
    address: targetAccount.address,
    entryPoint,
    plugins: {
      sudo: newEcdsaValidator,
    },
    kernelVersion: KERNEL_V3_1,
  });

  const newKernelClient = createKernelAccountClient({
    account: newAccount,
    chain: lineaSepolia,
    bundlerTransport: http(process.env.ZERODEV_RPC),
    paymaster: paymasterClient,
  });

  console.log('sending userOp with new signer');
  const userOpHash2 = await newKernelClient.sendUserOperation({
    callData: await newAccount.encodeCalls([
      {
        to: zeroAddress,
        value: BigInt(0),
        data: '0x',
      },
    ]),
  });
  console.log('userOp hash:', userOpHash2);

  await newKernelClient.waitForUserOperationReceipt({
    hash: userOpHash2,
  });
  console.log('userOp completed!');
};

main();
