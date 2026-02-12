import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

/**
 * Load deployment config from deployments/<network>.json using CHAIN_ID only.
 *
 * Expected JSON shape (example):
 *   { "chainId": 80002, "contracts": { "paymentToken": "0x..." }, "abiPaths": { "paymentToken": "artifacts/..." } }
 * Return value: { network, chainId, ...parsed } so contracts and abiPaths (and any other keys) are passed through.
 */

/**
 * Chain ID → network name mapping.
 * Used to select deployments/<network>.json from CHAIN_ID only.
 */
const CHAIN_ID_TO_NETWORK = {
  80002: "amoy",
  80001: "mumbai",
  5: "goerli",
  137: "polygon",
  31337: "localhost",
};

/**
 * Load deployment config from deployments/<network>.json based on process.env.CHAIN_ID.
 * Fails fast with clear errors if CHAIN_ID is missing, unsupported, file missing, or JSON invalid.
 *
 * @returns {{ network: string, chainId: number, contracts?: object, abiPaths?: object, [key: string]: unknown }}
 */
export function loadDeployment() {
  const raw = process.env.CHAIN_ID;
  if (raw === undefined || raw === "") {
    throw new Error(
      "CHAIN_ID is required. Set CHAIN_ID in your environment (e.g. in .env)."
    );
  }

  const chainId = parseInt(raw, 10);
  if (Number.isNaN(chainId)) {
    throw new Error(
      `CHAIN_ID must be a number. Got: ${JSON.stringify(raw)}`
    );
  }

  const network = CHAIN_ID_TO_NETWORK[chainId];
  if (network === undefined) {
    const supported = Object.entries(CHAIN_ID_TO_NETWORK)
      .map(([id, name]) => `${id} (${name})`)
      .join(", ");
    throw new Error(
      `Unsupported CHAIN_ID: ${chainId}. Supported: ${supported}.`
    );
  }

  // When running from backend/, use DEPLOYMENTS_PATH (e.g. ../blockchain/deployments) to read deployment output
  const deploymentsDir = process.env.DEPLOYMENTS_PATH
    ? resolve(process.cwd(), process.env.DEPLOYMENTS_PATH)
    : resolve(process.cwd(), "deployments");
  const filePath = resolve(deploymentsDir, `${network}.json`);

  if (!existsSync(filePath)) {
    throw new Error(
      `Deployment file not found: ${filePath}. Run deployment for network "${network}" first.`
    );
  }

  let parsed;
  try {
    const content = readFileSync(filePath, "utf-8");
    parsed = JSON.parse(content);
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(
        `Invalid JSON in deployment file ${filePath}: ${err.message}`
      );
    }
    throw new Error(
      `Cannot read deployment file ${filePath}: ${err.message}`
    );
  }

  if (parsed === null || typeof parsed !== "object") {
    throw new Error(
      `Deployment file ${filePath} must export a JSON object.`
    );
  }

  return {
    network,
    chainId,
    ...parsed,
  };
}

/**
 * Chain ID → network map for use by other modules (e.g. validation).
 */
export { CHAIN_ID_TO_NETWORK };
