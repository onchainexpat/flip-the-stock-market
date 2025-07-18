import 'dotenv/config';
import {
  KERNEL_V3_3_BETA,
  KernelVersionToAddressesMap,
  getEntryPoint,
} from '@zerodev/sdk/constants';
import { http, type Hex, createPublicClient, createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { erc7821Actions } from 'viem/experimental';

if (!process.env.ZERODEV_RPC) {
  throw new Error('ZERODEV_RPC is not set');
}

const ZERODEV_RPC = process.env.ZERODEV_RPC;
const entryPoint = getEntryPoint('0.7');
const kernelVersion = KERNEL_V3_3_BETA;

// We use the Sepolia testnet here, but you can use any network that
// supports EIP-7702.
const chain = sepolia;

const publicClient = createPublicClient({
  transport: http(ZERODEV_RPC),
  chain,
});

const main = async () => {
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is required');
  }

  const signer = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);
  console.log('EOA Address:', signer.address);

  const walletClient = createWalletClient({
    // Use any Viem-compatible EOA account
    account: signer,
    chain,
    transport: http(ZERODEV_RPC),
  }).extend(erc7821Actions());

  const authorization = await walletClient.signAuthorization({
    contractAddress:
      KernelVersionToAddressesMap[kernelVersion].accountImplementationAddress,
  });

  const hash = await walletClient.execute({
    address: signer.address,
    calls: [
      {
        to: '0x9775137314fE595c943712B0b336327dfa80aE8A',
        data: '0xdeadbeef',
        value: BigInt(1),
      },
      {
        to: '0x9775137314fE595c943712B0b336327dfa80aE8A',
        data: '0xcafecafe',
        value: BigInt(2),
      },
    ],
    authorizationList: [authorization],
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: hash,
  });

  console.log(
    'tx completed ,',
    `${chain.blockExplorers.default.url}/tx/${receipt.transactionHash}`,
  );

  process.exit(0);
};

main();
