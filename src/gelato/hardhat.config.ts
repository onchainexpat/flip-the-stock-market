import { HardhatUserConfig } from "hardhat/config";
import "@gelatonetwork/web3-functions-sdk/hardhat-plugin";
import "@nomiclabs/hardhat-ethers";

const config: HardhatUserConfig = {
  w3f: {
    rootDir: "./src/gelato",
    debug: false,
    networks: ["base"],
  },
  solidity: "0.8.19",
  networks: {
    base: {
      url: process.env.NEXT_PUBLIC_ZERODEV_RPC_URL || "https://mainnet.base.org",
      accounts: process.env.GELATO_DEPLOYER_PRIVATE_KEY ? [process.env.GELATO_DEPLOYER_PRIVATE_KEY] : [],
    },
  },
};

export default config;