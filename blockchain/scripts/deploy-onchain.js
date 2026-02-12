/**
 * Deploy on-chain set: StableToken, Vault, NFTPass.
 * Usage: npx hardhat run scripts/deploy-onchain.js --network amoy
 * Writes deployments/<network>.json for backend (StableToken, Vault, NFTPass).
 */
import { createRequire } from "module";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

const require = createRequire(import.meta.url);
const hre = require("hardhat");
const { ethers } = hre;

const NETWORK_TO_CHAIN_ID = {
  localhost: 31337,
  amoy: 80002,
  mumbai: 80001,
  goerli: 5,
  polygon: 137,
};

async function main() {
  const networkName = hre.network.name;

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  let resolvedChainId = NETWORK_TO_CHAIN_ID[networkName];
  if (resolvedChainId === undefined) {
    const hexId = await hre.network.provider.send("eth_chainId", []);
    resolvedChainId = parseInt(hexId, 16);
  }
  console.log("Network:", networkName, "ChainId:", resolvedChainId);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // 1. StableToken (ERC20, MINTER_ROLE, Pausable)
  console.log("Deploying StableToken...");
  const StableToken = await ethers.getContractFactory("StableToken");
  const stableToken = await StableToken.deploy(deployer.address);
  await stableToken.waitForDeployment();
  const stableTokenAddress = await stableToken.getAddress();
  console.log("StableToken at:", stableTokenAddress);

  // 2. Vault (custodial: deposit, withdrawTo, swap)
  console.log("\nDeploying Vault...");
  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy(deployer.address);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("Vault at:", vaultAddress);

  // 3. NFTPass (ERC721, MINTER_ROLE)
  console.log("\nDeploying NFTPass...");
  const NFTPass = await ethers.getContractFactory("NFTPass");
  const nftPass = await NFTPass.deploy(deployer.address);
  await nftPass.waitForDeployment();
  const nftPassAddress = await nftPass.getAddress();
  console.log("NFTPass at:", nftPassAddress);

  const deployment = {
    chainId: resolvedChainId,
    network: networkName,
    contracts: {
      StableToken: stableTokenAddress,
      Vault: vaultAddress,
      NFTPass: nftPassAddress,
      // Keep legacy keys if backend still expects them
      StableCoinWallet: stableTokenAddress,
      WalletNFT: nftPassAddress,
    },
  };

  const deploymentsDir = resolve(process.cwd(), "deployments");
  if (!existsSync(deploymentsDir)) mkdirSync(deploymentsDir, { recursive: true });
  const path = resolve(deploymentsDir, `${networkName}.json`);
  writeFileSync(path, JSON.stringify(deployment, null, 2), "utf-8");
  console.log("\n✅ Wrote", path);

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("StableToken:", stableTokenAddress);
  console.log("Vault:", vaultAddress);
  console.log("NFTPass:", nftPassAddress);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
