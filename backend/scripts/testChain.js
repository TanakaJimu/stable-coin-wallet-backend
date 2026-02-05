/**
 * Test backend → blockchain: load deployment, connect to Amoy, read from StableCoinWallet.
 * Run from backend folder: node scripts/testChain.js
 *
 * Prerequisites:
 * 1. backend/.env has BLOCKCHAIN_RPC_URL, CHAIN_ID=80002, DEPLOYMENTS_PATH=../blockchain/deployments
 * 2. blockchain/contracts compiled: cd blockchain && npm run compile
 * 3. Contracts deployed to Amoy: npm run deploy:amoy (from project root) so blockchain/deployments/amoy.json has real addresses
 */
import { resolve } from "path";
import dotenv from "dotenv";
import { loadDeployment } from "../src/config/loadDeployment.js";
import { getContracts } from "../src/blockchain/contracts.js";
import { ethers } from "ethers";

dotenv.config({ path: resolve(process.cwd(), ".env"), override: true });

async function main() {
  console.log("Loading deployment...");
  const deployment = loadDeployment();
  console.log("Network:", deployment.network, "chainId:", deployment.chainId);
  console.log("Contracts:", deployment.contracts);

  console.log("\nGetting contract instances (read-only)...");
  const { stableCoinWallet } = getContracts({ write: false });

  const name = await stableCoinWallet.name();
  const symbol = await stableCoinWallet.symbol();
  console.log("StableCoinWallet:", name, "(", symbol, ")");

  if (process.env.BACKEND_SIGNER_PRIVATE_KEY) {
    const wallet = new ethers.Wallet(process.env.BACKEND_SIGNER_PRIVATE_KEY);
    const balance = await stableCoinWallet.balanceOf(wallet.address);
    console.log("Backend signer balance:", ethers.formatEther(balance), symbol);
  }

  console.log("\n Backend → blockchain test passed.");
}

main().catch((e) => {
  console.error("FAILED:", e.message || e);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
