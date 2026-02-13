/**
 * Deploy MockSwap to Polygon Amoy. Requires MockUSDT and MockUSDC in deployments/amoy.json.
 * Writes MockSwap address to deployments/amoy.json.
 *
 * Usage: npx hardhat run scripts/deploy-mockswap.js --network amoy
 */
import { createRequire } from "module";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

const require = createRequire(import.meta.url);
const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const deploymentsDir = resolve(process.cwd(), "deployments");
  const deploymentPath = resolve(deploymentsDir, "amoy.json");
  if (!existsSync(deploymentPath)) {
    throw new Error("deployments/amoy.json not found. Run deploy-mock-stablecoins.js first.");
  }
  const deployment = JSON.parse(readFileSync(deploymentPath, "utf-8"));
  const mockUsdt = deployment.contracts?.MockUSDT;
  const mockUsdc = deployment.contracts?.MockUSDC;
  if (!mockUsdt || !mockUsdc) {
    throw new Error("MockUSDT and MockUSDC must be in deployments/amoy.json");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("MockUSDT:", mockUsdt, "MockUSDC:", mockUsdc);

  const MockSwap = await ethers.getContractFactory("MockSwap");
  const feeBps = 100; // 1%
  const mockSwap = await MockSwap.deploy(mockUsdt, mockUsdc, feeBps);
  await mockSwap.waitForDeployment();
  const mockSwapAddress = await mockSwap.getAddress();
  console.log("MockSwap deployed to:", mockSwapAddress);

  deployment.contracts = { ...deployment.contracts, MockSwap: mockSwapAddress };
  if (!existsSync(deploymentsDir)) mkdirSync(deploymentsDir, { recursive: true });
  writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2), "utf-8");
  console.log("Wrote", deploymentPath);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
