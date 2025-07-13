import 'dotenv/config';
import {
  deserializePermissionAccount,
  serializePermissionAccount,
  toPermissionValidator,
} from '@zerodev/permissions';
import { toSudoPolicy } from '@zerodev/permissions/policies';
import { toECDSASigner } from '@zerodev/permissions/signers';
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';
import { createWeightedECDSAValidator } from '@zerodev/weighted-ecdsa-validator';
import {
  http,
  type Address,
  createPublicClient,
  parseAbi,
  zeroAddress,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

if (!process.env.ZERODEV_RPC || !process.env.PRIVATE_KEY) {
  throw new Error('ZERODEV_RPC or PRIVATE_KEY is not set');
}

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.ZERODEV_RPC),
});

const signer1 = privateKeyToAccount(generatePrivateKey());
const signer2 = privateKeyToAccount(generatePrivateKey());
const signer3 = privateKeyToAccount(generatePrivateKey());

const contractAddress = '0x34bE7f35132E97915633BC1fc020364EA5134863' as Address;
const contractABI = parseAbi([
  'function mint(address _to) public',
  'function balanceOf(address owner) external view returns (uint256 balance)',
]);
const sessionPrivateKey = generatePrivateKey();
const entryPoint = getEntryPoint('0.7');

const createSessionKey = async () => {
  const multisigValidator = await createWeightedECDSAValidator(publicClient, {
    entryPoint,
    config: {
      threshold: 100,
      signers: [
        { address: signer1.address as Address, weight: 100 },
        { address: signer2.address as Address, weight: 50 },
        { address: signer3.address as Address, weight: 50 },
      ],
    },
    signers: [signer1],
    kernelVersion: KERNEL_V3_1,
  });

  const masterAccount = await createKernelAccount(publicClient, {
    entryPoint,
    plugins: {
      sudo: multisigValidator,
    },
    kernelVersion: KERNEL_V3_1,
  });
  console.log('Account address:', masterAccount.address);

  const sessionKeySigner = await toECDSASigner({
    signer: privateKeyToAccount(sessionPrivateKey),
  });

  const sessionKeyValidator = await toPermissionValidator(publicClient, {
    entryPoint,
    signer: sessionKeySigner,
    policies: [toSudoPolicy({})],
    kernelVersion: KERNEL_V3_1,
  });

  const sessionKeyAccount = await createKernelAccount(publicClient, {
    entryPoint,
    plugins: {
      sudo: multisigValidator,
      regular: sessionKeyValidator,
    },
    kernelVersion: KERNEL_V3_1,
  });

  // Serialize the session key account with its private key
  return await serializePermissionAccount(sessionKeyAccount, sessionPrivateKey);
};

const useSessionKey = async (serializedSessionKey: string) => {
  // Deserialize the session key account
  const sessionKeyAccount = await deserializePermissionAccount(
    publicClient,
    entryPoint,
    KERNEL_V3_1,
    serializedSessionKey
  );

  const kernelPaymaster = createZeroDevPaymasterClient({
    chain: sepolia,
    transport: http(process.env.ZERODEV_RPC),
  });

  const kernelClient = createKernelAccountClient({
    account: sessionKeyAccount,
    chain: sepolia,
    bundlerTransport: http(process.env.ZERODEV_RPC),
    paymaster: {
      getPaymasterData(userOperation) {
        return kernelPaymaster.sponsorUserOperation({ userOperation });
      },
    },
  });

  const userOpHash = await kernelClient.sendUserOperation({
    callData: await sessionKeyAccount.encodeCalls([
      {
        to: zeroAddress,
        value: BigInt(0),
        data: '0x',
      },
    ]),
  });

  console.log('UserOp hash:', userOpHash);

  const { receipt } = await kernelClient.waitForUserOperationReceipt({
    hash: userOpHash,
  });
  console.log('UserOp completed!', receipt.transactionHash);
};

const main = async () => {
  // The owner creates a session key and shares the serialized data with the agent
  const serializedSessionKey = await createSessionKey();

  // The agent uses the serialized session key data to perform operations
  await useSessionKey(serializedSessionKey);
};

main();
