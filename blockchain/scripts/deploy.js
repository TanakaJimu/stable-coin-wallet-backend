import { createRequire } from "module";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

// Use CommonJS require to load Hardhat (which is a CJS module) while keeping this file as .js (ESM)
const require = createRequire(import.meta.url);
const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  console.log("Starting deployment to Polygon Amoy...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString(), "\n");

  // Deploy StableCoinWallet (ERC20)
  console.log("Deploying StableCoinWallet...");
  const StableCoinWallet = await ethers.getContractFactory("StableCoinWallet");
  const stableCoin = await StableCoinWallet.deploy(deployer.address);
  await stableCoin.waitForDeployment();
  const stableCoinAddress = await stableCoin.getAddress();
  console.log("StableCoinWallet deployed to:", stableCoinAddress);

// Deploy WalletNFT (ERC721, paid with stablecoin)
console.log("\nDeploying WalletNFT...");

// NFT mint price: 10 SWC (adjust as you like)
const mintPrice = ethers.parseUnits("10", 18);

// Max supply cap
const maxSupply = 10000;

const WalletNFT = await ethers.getContractFactory("WalletNFT");
const walletNft = await WalletNFT.deploy(
  deployer.address,      // initialOwner
  stableCoinAddress,     // paymentTokenAddress (SWC)
  deployer.address,      // treasuryAddress (receives SWC payments)
  mintPrice,             // price
  maxSupply              // supplyCap
);

await walletNft.waitForDeployment();
const walletNftAddress = await walletNft.getAddress();
console.log("WalletNFT deployed to:", walletNftAddress);


  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("STABLE_COIN_WALLET_ADDRESS=" + stableCoinAddress);
  console.log("WALLET_NFT_ADDRESS=" + walletNftAddress);
  console.log("=".repeat(60) + "\n");

  // Write deployments/amoy.json (for backend loadDeployment when DEPLOYMENTS_PATH=../blockchain/deployments)
  const deploymentsDir = resolve(process.cwd(), "deployments");
  if (!existsSync(deploymentsDir)) {
    mkdirSync(deploymentsDir, { recursive: true });
  }
  const deploymentPath = resolve(deploymentsDir, "amoy.json");
  const deployment = {
    chainId: 80002,
    network: "amoy",
    contracts: {
      StableCoinWallet: stableCoinAddress,
      WalletNFT: walletNftAddress,
    },
  };
  writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2), "utf-8");
  console.log("✅ Wrote", deploymentPath);

  // Update .env in blockchain folder
  const envPath = resolve(process.cwd(), ".env");
  let envContent = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";

  const updateEnvVar = (content, key, value) => {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      return content.replace(regex, `${key}=${value}`);
    }
    const trimmed = content.trimEnd();
    return trimmed + (trimmed && !trimmed.endsWith("\n") ? "\n" : "") + `${key}=${value}\n`;
  };

  envContent = updateEnvVar(envContent, "STABLE_COIN_WALLET_ADDRESS", stableCoinAddress);
  envContent = updateEnvVar(envContent, "WALLET_NFT_ADDRESS", walletNftAddress);
  writeFileSync(envPath, envContent, "utf-8");
  console.log(" Updated .env with contract addresses\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
