/**
 * Mint MockUSDT and/or MockUSDC to a recipient (e.g. MetaMask address).
 * Uses deployments/amoy.json for contract addresses. Deployer must have MINTER_ROLE.
 *
 * Usage:
 *   npx hardhat run scripts/mint-mock-tokens.js --network amoy
 *   RECIPIENT=0xYourAddress AMOUNT_USDT=1000 AMOUNT_USDC=1000 npx hardhat run scripts/mint-mock-tokens.js --network amoy
 */
import { createRequire } from "module";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const require = createRequire(import.meta.url);
const hre = require("hardhat");
const { ethers } = hre;

const DECIMALS = 6;

async function main() {
  const recipient = process.env.RECIPIENT;
  if (!recipient || !ethers.isAddress(recipient)) {
    throw new Error("Set RECIPIENT=0x... (valid address)");
  }
  const amountUsdt = process.env.AMOUNT_USDT ? String(process.env.AMOUNT_USDT) : "10000";
  const amountUsdc = process.env.AMOUNT_USDC ? String(process.env.AMOUNT_USDC) : "10000";

  const deploymentPath = resolve(process.cwd(), "deployments", "amoy.json");
  if (!existsSync(deploymentPath)) throw new Error("deployments/amoy.json not found");
  const deployment = JSON.parse(readFileSync(deploymentPath, "utf-8"));
  const mockUsdtAddr = deployment.contracts?.MockUSDT;
  const mockUsdcAddr = deployment.contracts?.MockUSDC;
  if (!mockUsdtAddr || !mockUsdcAddr) throw new Error("MockUSDT/MockUSDC not in amoy.json");

  const [deployer] = await ethers.getSigners();
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdt = MockUSDT.attach(mockUsdtAddr);
  const usdc = MockUSDC.attach(mockUsdcAddr);

  const usdtAmountWei = ethers.parseUnits(amountUsdt, DECIMALS);
  const usdcAmountWei = ethers.parseUnits(amountUsdc, DECIMALS);

  const tx1 = await usdt.mint(recipient, usdtAmountWei);
  await tx1.wait();
  console.log("Minted", amountUsdt, "MockUSDT to", recipient);

  const tx2 = await usdc.mint(recipient, usdcAmountWei);
  await tx2.wait();
  console.log("Minted", amountUsdc, "MockUSDC to", recipient);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
