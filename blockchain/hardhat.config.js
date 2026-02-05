import "@nomicfoundation/hardhat-ethers";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

dotenvConfig({ path: resolve(process.cwd(), ".env") });

export default {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
    networks: {
      localhost: {
        url: "http://127.0.0.1:8545",
        chainId: 31337
      },
    amoy: {
      url: process.env.BLOCKCHAIN_RPC_URL || "",
      chainId: 80002,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  }
};
