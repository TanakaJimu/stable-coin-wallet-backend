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
      url: process.env.RPC_URL || process.env.BLOCKCHAIN_RPC_URL || "",
      chainId: 80002,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    mumbai: {
      url: process.env.BLOCKCHAIN_RPC_URL || process.env.RPC_URL || "https://rpc.ankr.com/polygon_mumbai",
      chainId: 80001,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    goerli: {
      url: process.env.BLOCKCHAIN_RPC_URL || process.env.RPC_URL || "https://rpc.ankr.com/eth_goerli",
      chainId: 5,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    polygon: {
      url: process.env.BLOCKCHAIN_RPC_URL || process.env.RPC_URL || "https://polygon-rpc.com",
      chainId: 137,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  }
};
