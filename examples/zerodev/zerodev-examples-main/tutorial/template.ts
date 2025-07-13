import 'dotenv/config';
import { getEntryPoint } from '@zerodev/sdk/constants';
import { http, createPublicClient, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';

if (!process.env.ZERODEV_RPC) {
  throw new Error('ZERODEV_RPC is not set');
}

const ZERODEV_RPC = process.env.ZERODEV_RPC;

// The NFT contract we will be interacting with
const contractAddress = '0x34bE7f35132E97915633BC1fc020364EA5134863';
const contractABI = parseAbi([
  'function mint(address _to) public',
  'function balanceOf(address owner) external view returns (uint256 balance)',
]);

// Construct a public client
const publicClient = createPublicClient({
  transport: http(ZERODEV_RPC),
});

const chain = sepolia;
const entryPoint = getEntryPoint('0.7');

const main = async () => {
  // your code goes here
};

main();
