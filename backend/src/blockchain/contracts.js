/**
 * Load ABIs from Hardhat artifacts and return ethers Contract instances.
 * Supports legacy (StableCoinWallet, WalletNFT), on-chain set (StableToken, Vault, NFTPass),
 * and mock stablecoins (MockUSDT, MockUSDC) on Polygon Amoy.
 */
import { ethers } from "ethers";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { loadDeployment } from "../config/loadDeployment.js";
import { getRunner } from "./client.js";

const ARTIFACTS_BASE = resolve(process.cwd(), "..", "blockchain", "artifacts", "contracts");

function loadArtifact(contractName) {
  const artifactPath = resolve(ARTIFACTS_BASE, `${contractName}.sol`, `${contractName}.json`);
  if (!existsSync(artifactPath)) throw new Error(`Artifact not found: ${artifactPath}`);
  const raw = readFileSync(artifactPath, "utf-8");
  const artifact = JSON.parse(raw);
  if (!artifact.abi) throw new Error(`ABI missing for ${contractName}`);
  return artifact;
}

function tryLoadArtifact(contractName) {
  try {
    return loadArtifact(contractName);
  } catch {
    return null;
  }
}

/**
 * Get contract instances. write=false => read-only (provider), write=true => signer (operator).
 */
export function getContracts({ write = false } = {}) {
  const deployment = loadDeployment();
  const runner = getRunner({ write });
  const c = deployment.contracts || {};

  const result = { deployment };

  // At least one token contract must exist (stable or mocks)
  const hasStable = !!(c.StableToken || c.StableCoinWallet);
  const hasMocks = !!(c.MockUSDT || c.MockUSDC);
  if (!hasStable && !hasMocks) throw new Error("Deployment missing token contracts (StableToken, StableCoinWallet, MockUSDT, or MockUSDC)");

  // Stable token (optional when mocks exist)
  if (hasStable) {
    const stableAddress = c.StableToken || c.StableCoinWallet;
    const StableArtifact = tryLoadArtifact("StableToken") || loadArtifact("StableCoinWallet");
    result.stableToken = new ethers.Contract(stableAddress, StableArtifact.abi, runner);
    result.stableCoinWallet = result.stableToken;
  }

  // Mock stablecoins (6 decimals)
  if (c.MockUSDT) {
    const abi = tryLoadArtifact("MockUSDT");
    if (abi) result.mockUsdt = new ethers.Contract(c.MockUSDT, abi.abi, runner);
  }
  if (c.MockUSDC) {
    const abi = tryLoadArtifact("MockUSDC");
    if (abi) result.mockUsdc = new ethers.Contract(c.MockUSDC, abi.abi, runner);
  }

  // Vault (on-chain only)
  if (c.Vault) {
    const VaultArtifact = tryLoadArtifact("Vault");
    if (VaultArtifact) result.vault = new ethers.Contract(c.Vault, VaultArtifact.abi, runner);
  }

  // NFT: prefer NFTPass (on-chain), fallback WalletNFT (legacy)
  const nftAddress = c.NFTPass || c.WalletNFT;
  if (nftAddress) {
    const NftArtifact = tryLoadArtifact("NFTPass") || loadArtifact("WalletNFT");
    result.nftPass = new ethers.Contract(nftAddress, NftArtifact.abi, runner);
    result.walletNFT = result.nftPass;
  }

  return result;
}

/** Decimals for mock tokens (USDT/USDC use 6). */
const MOCK_DECIMALS = 6;

/**
 * Get the ERC20 contract and decimals for an asset when mock tokens are deployed.
 * @param {object} contracts - Result of getContracts()
 * @param {string} asset - e.g. "USDT", "USDC"
 * @returns {{ contract: ethers.Contract, decimals: number } | null}
 */
export function getTokenForAsset(contracts, asset) {
  const A = String(asset || "").toUpperCase();
  if (A === "USDT" && contracts.mockUsdt) return { contract: contracts.mockUsdt, decimals: MOCK_DECIMALS };
  if (A === "USDC" && contracts.mockUsdc) return { contract: contracts.mockUsdc, decimals: MOCK_DECIMALS };
  if ((A === "SWC" || A === "USD") && contracts.stableToken) return { contract: contracts.stableToken, decimals: 18 };
  return null;
}
