/**
 * Seed MockSwap with liquidity by transferring MockUSDT and MockUSDC into the contract.
 * Deployer must have minted tokens (run mint-mock-tokens.js first) or hold balance.
 *
 * Usage:
 *   AMOUNT=10000 npx hardhat run scripts/seed-swap-liquidity.js --network amoy
 */
import { createRequire } from "module";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const require = createRequire(import.meta.url);
const hre = require("hardhat");
const { ethers } = hre;

const DECIMALS = 6;

async function main() {
  const amount = process.env.AMOUNT ? String(process.env.AMOUNT) : "100000";
  const deploymentPath = resolve(process.cwd(), "deployments", "amoy.json");
  if (!existsSync(deploymentPath)) throw new Error("deployments/amoy.json not found");
  const deployment = JSON.parse(readFileSync(deploymentPath, "utf-8"));
  const mockUsdtAddr = deployment.contracts?.MockUSDT;
  const mockUsdcAddr = deployment.contracts?.MockUSDC;
  const mockSwapAddr = deployment.contracts?.MockSwap;
  if (!mockUsdtAddr || !mockUsdcAddr || !mockSwapAddr) {
    throw new Error("MockUSDT, MockUSDC, MockSwap must be in amoy.json");
  }

  const [deployer] = await ethers.getSigners();
  const amountWei = ethers.parseUnits(amount, DECIMALS);

  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdt = MockUSDT.attach(mockUsdtAddr);
  const usdc = MockUSDC.attach(mockUsdcAddr);

  const t1 = await usdt.transfer(mockSwapAddr, amountWei);
  await t1.wait();
  console.log("Transferred", amount, "MockUSDT to MockSwap");

  const t2 = await usdc.transfer(mockSwapAddr, amountWei);
  await t2.wait();
  console.log("Transferred", amount, "MockUSDC to MockSwap");
  console.log("MockSwap liquidity seeded.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
