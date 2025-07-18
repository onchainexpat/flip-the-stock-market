import 'dotenv/config';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  addressToEmptyAccount,
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { KERNEL_V2_4, getEntryPoint } from '@zerodev/sdk/constants';
import {
  ParamOperator,
  deserializeSessionKeyAccount,
  oneAddress,
  serializeSessionKeyAccount,
  signerToSessionKeyValidator,
} from '@zerodev/session-key';
import {
  http,
  type Address,
  type Hex,
  createPublicClient,
  encodeFunctionData,
  parseAbi,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

if (!process.env.ZERODEV_RPC || !process.env.PRIVATE_KEY) {
  throw new Error('ZERODEV_RPC or PRIVATE_KEY is not set');
}

const publicClient = createPublicClient({
  transport: http(process.env.ZERODEV_RPC),
  chain: sepolia,
});

const signer = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);
const contractAddress = '0x34bE7f35132E97915633BC1fc020364EA5134863';
const contractABI = parseAbi([
  'function mint(address _to) public',
  'function balanceOf(address owner) external view returns (uint256 balance)',
]);
const entryPoint = getEntryPoint('0.6');

const createSessionKey = async (sessionKeyAddress: Address) => {
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    entryPoint,
    signer,
    kernelVersion: KERNEL_V2_4,
  });

  const masterAccount = await createKernelAccount(publicClient, {
    entryPoint,
    plugins: {
      sudo: ecdsaValidator,
    },
    kernelVersion: KERNEL_V2_4,
  });
  console.log('Account address:', masterAccount.address);

  // Create an "empty account" as the signer -- you only need the public
  // key (address) to do this.
  const emptySessionKeySigner = addressToEmptyAccount(sessionKeyAddress);

  const sessionKeyValidator = await signerToSessionKeyValidator(publicClient, {
    entryPoint,
    signer: emptySessionKeySigner,
    validatorData: {
      paymaster: oneAddress,
      permissions: [
        {
          target: contractAddress,
          // Maximum value that can be transferred.  In this case we
          // set it to zero so that no value transfer is possible.
          valueLimit: BigInt(0),
          // Contract abi
          abi: contractABI,
          // Function name
          functionName: 'mint',
          // An array of conditions, each corresponding to an argument for
          // the function.
          args: [
            {
              // In this case, we are saying that the session key can only mint
              // NFTs to the account itself
              operator: ParamOperator.EQUAL,
              value: masterAccount.address,
            },
          ],
        },
      ],
    },
    kernelVersion: KERNEL_V2_4,
  });

  const sessionKeyAccount = await createKernelAccount(publicClient, {
    entryPoint,
    plugins: {
      sudo: ecdsaValidator,
      regular: sessionKeyValidator,
    },
    kernelVersion: KERNEL_V2_4,
  });

  return await serializeSessionKeyAccount(sessionKeyAccount);
};

const useSessionKey = async (
  serializedSessionKey: string,
  sessionKeySigner: any,
) => {
  const sessionKeyAccount = await deserializeSessionKeyAccount(
    publicClient,
    entryPoint,
    KERNEL_V2_4,
    serializedSessionKey,
    sessionKeySigner,
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
        to: contractAddress,
        value: BigInt(0),
        data: encodeFunctionData({
          abi: contractABI,
          functionName: 'mint',
          args: [sessionKeyAccount.address],
        }),
      },
    ]),
  });

  console.log('userOp hash:', userOpHash);
};

const main = async () => {
  // The agent creates a public-private key pair and sends
  // the public key (address) to the owner.
  const sessionPrivateKey = generatePrivateKey();
  const sessionKeySigner = privateKeyToAccount(sessionPrivateKey);

  // The owner authorizes the public key by signing it and sending
  // back the signature
  const serializedSessionKey = await createSessionKey(sessionKeySigner.address);

  // The agent constructs a full session key
  await useSessionKey(serializedSessionKey, sessionKeySigner);
};

main();
