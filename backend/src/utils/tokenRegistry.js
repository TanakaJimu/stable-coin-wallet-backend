/**
 * Token & network registry: POLYGON_AMOY -> { USDT, USDC, DAI } with { address, decimals }.
 * Uses AMOY_MOCK_USDT, AMOY_MOCK_USDC, AMOY_MOCK_DAI from .env (optional).
 * Normalize asset/network to uppercase.
 */
const POLYGON_AMOY = "POLYGON_AMOY";
const POLYGON = "POLYGON";

function norm(s) {
  return String(s ?? "").toUpperCase().trim();
}

/** Map network -> assets -> { address, decimals }. Address from env or null if not set. */
const NETWORK_TOKENS = {
  [POLYGON_AMOY]: {
    USDT: {
      address: ("0x83e4D17029a1a81D5f4bBD1D3ef1c1c91f35022f" || process.env.MOCK_USDT_ADDRESS || "").trim() || null,
      decimals: 6,
    },
    USDC: {
      address: ("0x23c6cDA5C992acDdc99cB8DF1164D42D20E77838"|| process.env.MOCK_USDC_ADDRESS || "").trim() || null,
      decimals: 6,
    },
    DAI: {
      address: (process.env.AMOY_MOCK_DAI || "").trim() || null,
      decimals: 18,
    },
  },
};

// POLYGON (mainnet) could be added later; for Amoy we alias to POLYGON_AMOY
NETWORK_TOKENS[POLYGON] = NETWORK_TOKENS[POLYGON_AMOY];

/**
 * @param {string} asset - e.g. USDT, USDC, DAI
 * @param {string} network - e.g. POLYGON_AMOY
 * @returns {{ address: string, decimals: number } | null} null if asset/network not supported or no contract address
 */
export function getTokenInfo(asset, network) {
  const a = norm(asset);
  const n = norm(network);
  const n2 = n === "POLYGON" ? POLYGON_AMOY : n;
  const tokens = NETWORK_TOKENS[n] ?? NETWORK_TOKENS[n2];
  if (!tokens) return null;
  const info = tokens[a];
  if (!info || !info.address) return null;
  return { address: info.address.toLowerCase(), decimals: info.decimals };
}

/**
 * Normalize network to uppercase; POLYGON -> POLYGON_AMOY for Amoy.
 */
export function normalizeNetwork(network) {
  const n = norm(network);
  return n === "POLYGON" ? POLYGON_AMOY : n;
}

export function normalizeAsset(asset) {
  return norm(asset);
}

export const SUPPORTED_ONCHAIN_NETWORKS = [POLYGON_AMOY, POLYGON];
/** Assets that may have on-chain contracts on Amoy (USDT, USDC, DAI). */
export const SUPPORTED_ONCHAIN_ASSETS = ["USDT", "USDC", "DAI"];
