import hre from "hardhat";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

const { ethers } = hre;

async function main() {
  console.log("Starting deployment to Polygon Amoy...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log(
    "Account balance:",
    (await ethers.provider.getBalance(deployer.address)).toString(),
    "\n"
  );

  // Deploy StableCoinWallet
  console.log("Deploying StableCoinWallet...");
  const StableCoinWallet = await ethers.getContractFactory("StableCoinWallet");
  const stableCoin = await StableCoinWallet.deploy(deployer.address);
  await stableCoin.waitForDeployment();
  const stableCoinAddress = await stableCoin.getAddress();
  console.log("StableCoinWallet deployed to:", stableCoinAddress);

  // Deploy WalletNFT
  console.log("\nDeploying WalletNFT...");
  const WalletNFT = await ethers.getContractFactory("WalletNFT");
  const walletNft = await WalletNFT.deploy(
    deployer.address,      // owner
    stableCoinAddress      // payment token
  );
  await walletNft.waitForDeployment();
  const walletNftAddress = await walletNft.getAddress();
  console.log("WalletNFT deployed to:", walletNftAddress);

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("STABLE_COIN_WALLET_ADDRESS=" + stableCoinAddress);
  console.log("WALLET_NFT_ADDRESS=" + walletNftAddress);
  console.log("MINT_PRICE_SWC=10");
  console.log("=".repeat(60) + "\n");

  // Write deployments/amoy.json
  const deploymentsDir = resolve(process.cwd(), "deployments");
  if (!existsSync(deploymentsDir)) mkdirSync(deploymentsDir, { recursive: true });

  const deploymentPath = resolve(deploymentsDir, "amoy.json");
  writeFileSync(
    deploymentPath,
    JSON.stringify(
      {
        chainId: 80002,
        network: "amoy",
        contracts: {
          StableCoinWallet: stableCoinAddress,
          WalletNFT: walletNftAddress
        }
      },
      null,
      2
    ),
    "utf-8"
  );
  console.log("✅ Wrote", deploymentPath);

  // Update blockchain/.env with contract addresses
  const envPath = resolve(process.cwd(), ".env");
  let envContent = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";

  const updateEnvVar = (content, key, value) => {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) return content.replace(regex, `${key}=${value}`);
    const trimmed = content.trimEnd();
    return trimmed + (trimmed && !trimmed.endsWith("\n") ? "\n" : "") + `${key}=${value}\n`;
  };

  envContent = updateEnvVar(envContent, "STABLE_COIN_WALLET_ADDRESS", stableCoinAddress);
  envContent = updateEnvVar(envContent, "WALLET_NFT_ADDRESS", walletNftAddress);

  writeFileSync(envPath, envContent, "utf-8");
  console.log("✅ Updated .env with contract addresses\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
