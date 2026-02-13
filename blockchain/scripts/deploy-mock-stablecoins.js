/**
 * Deploy MockUSDT and MockUSDC to Polygon Amoy (or network in use).
 * Saves addresses to deployments/amoy.json (merges with existing contracts if file exists).
 *
 * Usage: npx hardhat run scripts/deploy-mock-stablecoins.js --network amoy
 */
import { createRequire } from "module";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

const require = createRequire(import.meta.url);
const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const networkName = hre.network.name;
  const chainId = hre.network.config.chainId ?? (await hre.network.provider.send("eth_chainId", [])).then((id) => parseInt(id, 16));

  console.log("Deploying mock stablecoins to", networkName, "...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Deploy MockUSDT
  console.log("Deploying MockUSDT...");
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const mockUsdt = await MockUSDT.deploy(deployer.address);
  await mockUsdt.waitForDeployment();
  const mockUsdtAddress = await mockUsdt.getAddress();
  console.log("MockUSDT deployed to:", mockUsdtAddress);

  // Deploy MockUSDC
  console.log("\nDeploying MockUSDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUsdc = await MockUSDC.deploy(deployer.address);
  await mockUsdc.waitForDeployment();
  const mockUsdcAddress = await mockUsdc.getAddress();
  console.log("MockUSDC deployed to:", mockUsdcAddress);

  // Resolve chainId if it was a promise
  const resolvedChainId = typeof chainId === "number" ? chainId : await chainId;

  // Load existing deployment if present (for amoy we merge)
  const deploymentsDir = resolve(process.cwd(), "deployments");
  if (!existsSync(deploymentsDir)) mkdirSync(deploymentsDir, { recursive: true });
  const deploymentPath = resolve(deploymentsDir, "amoy.json");

  let deployment = {
    chainId: resolvedChainId,
    network: "amoy",
    contracts: {},
  };
  if (existsSync(deploymentPath)) {
    try {
      const existing = JSON.parse(readFileSync(deploymentPath, "utf-8"));
      deployment = { ...existing, contracts: { ...(existing.contracts || {}), MockUSDT: mockUsdtAddress, MockUSDC: mockUsdcAddress } };
    } catch (_) {
      deployment.contracts = { MockUSDT: mockUsdtAddress, MockUSDC: mockUsdcAddress };
    }
  } else {
    deployment.contracts = { MockUSDT: mockUsdtAddress, MockUSDC: mockUsdcAddress };
  }

  writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2), "utf-8");
  console.log("\n✅ Wrote", deploymentPath);

  console.log("\n" + "=".repeat(50));
  console.log("DEPLOYED ADDRESSES");
  console.log("=".repeat(50));
  console.log("MockUSDT:", mockUsdtAddress);
  console.log("MockUSDC:", mockUsdcAddress);
  console.log("=".repeat(50));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
