/**
 * Load ABIs from Hardhat artifacts and return ethers Contract instances.
 * Supports legacy (StableCoinWallet, WalletNFT) and on-chain set (StableToken, Vault, NFTPass).
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

  // Stable token: prefer StableToken (on-chain), fallback StableCoinWallet (legacy)
  const stableAddress = c.StableToken || c.StableCoinWallet;
  if (!stableAddress) throw new Error("Deployment missing contracts.StableToken or StableCoinWallet");
  const StableArtifact = tryLoadArtifact("StableToken") || loadArtifact("StableCoinWallet");
  result.stableToken = new ethers.Contract(stableAddress, StableArtifact.abi, runner);
  result.stableCoinWallet = result.stableToken;

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
