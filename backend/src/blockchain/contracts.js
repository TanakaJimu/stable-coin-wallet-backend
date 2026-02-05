import { ethers } from "ethers";
import { readFileSync } from "fs";
import { resolve } from "path";
import { loadDeployment } from "../config/loadDeployment.js";
import { getRunner } from "./client.js";

function loadArtifact(contractName) {
  // Adjust if your artifacts path differs.
  // This assumes you run hardhat compile and artifacts exist in /blockchain/artifacts/...
  const artifactPath = resolve(
    process.cwd(),
    "..",                 // from backend/ to project root
    "blockchain",
    "artifacts",
    "contracts",
    `${contractName}.sol`,
    `${contractName}.json`
  );

  const artifactRaw = readFileSync(artifactPath, "utf-8");
  const artifact = JSON.parse(artifactRaw);

  if (!artifact.abi) {
    throw new Error(`ABI missing in artifact for ${contractName}: ${artifactPath}`);
  }

  return artifact;
}

/**
 * Returns live ethers Contract instances using:
 * - address from deployments (loadDeployment)
 * - ABI from hardhat artifacts
 *
 * write=false => provider runner
 * write=true  => signer runner (requires BACKEND_SIGNER_PRIVATE_KEY)
 */
export function getContracts({ write = false } = {}) {
  const deployment = loadDeployment(); // must return { chainId, contracts: { StableCoinWallet, WalletNFT } }

  const runner = getRunner({ write });

  const stableCoinWalletAddress = deployment.contracts?.StableCoinWallet;
  const walletNftAddress = deployment.contracts?.WalletNFT;

  if (!stableCoinWalletAddress) throw new Error("Deployment missing contracts.StableCoinWallet");
  if (!walletNftAddress) throw new Error("Deployment missing contracts.WalletNFT");

  const stableCoinArtifact = loadArtifact("StableCoinWallet");
  const walletNftArtifact = loadArtifact("WalletNFT");

  const stableCoinWallet = new ethers.Contract(
    stableCoinWalletAddress,
    stableCoinArtifact.abi,
    runner
  );

  const walletNFT = new ethers.Contract(
    walletNftAddress,
    walletNftArtifact.abi,
    runner
  );

  return { stableCoinWallet, walletNFT, deployment };
}
