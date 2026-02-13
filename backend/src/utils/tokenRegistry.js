/**
 * Token & network registry: { asset, network } => { tokenAddress, decimals }.
 * Normalize asset/network to uppercase. POLYGON and POLYGON_AMOY both map to Amoy (chainId 80002).
 */
const AMOY = "POLYGON_AMOY";
const POLYGON = "POLYGON";

function norm(s) {
  return String(s ?? "").toUpperCase().trim();
}

/**
 * Build registry from env (MOCK_USDT_ADDRESS, MOCK_USDC_ADDRESS) or deployment.
 * Supports USDT, USDC on POLYGON_AMOY / POLYGON (Amoy). Other networks marked off-chain only.
 */
function getRegistry() {
  const usdt = process.env.MOCK_USDT_ADDRESS || "";
  const usdc = process.env.MOCK_USDC_ADDRESS || "";
  const map = new Map();
  const key = (asset, network) => `${norm(asset)}:${norm(network)}`;

  if (usdt) {
    map.set(key("USDT", AMOY), { tokenAddress: usdt.toLowerCase(), decimals: 6, onchain: true });
    map.set(key("USDT", POLYGON), { tokenAddress: usdt.toLowerCase(), decimals: 6, onchain: true });
  } else {
    map.set(key("USDT", AMOY), { tokenAddress: null, decimals: 6, onchain: false });
    map.set(key("USDT", POLYGON), { tokenAddress: null, decimals: 6, onchain: false });
  }
  if (usdc) {
    map.set(key("USDC", AMOY), { tokenAddress: usdc.toLowerCase(), decimals: 6, onchain: true });
    map.set(key("USDC", POLYGON), { tokenAddress: usdc.toLowerCase(), decimals: 6, onchain: true });
  } else {
    map.set(key("USDC", AMOY), { tokenAddress: null, decimals: 6, onchain: false });
    map.set(key("USDC", POLYGON), { tokenAddress: null, decimals: 6, onchain: false });
  }

  return map;
}

const registry = getRegistry();

/**
 * @param {string} asset - e.g. USDT, USDC
 * @param {string} network - e.g. POLYGON_AMOY, POLYGON
 * @returns {{ tokenAddress: string | null, decimals: number, onchain: boolean } | null}
 */
export function getTokenInfo(asset, network) {
  const a = norm(asset);
  const n = norm(network);
  const n2 = n === "POLYGON" ? AMOY : n;
  return registry.get(`${a}:${n}`) ?? registry.get(`${a}:${n2}`) ?? null;
}

/**
 * Normalize network/asset to uppercase.
 */
export function normalizeNetwork(network) {
  const n = norm(network);
  return n === "POLYGON" ? AMOY : n;
}
export function normalizeAsset(asset) {
  return norm(asset);
}

export const SUPPORTED_ONCHAIN_NETWORKS = [AMOY, POLYGON];
export const SUPPORTED_ONCHAIN_ASSETS = ["USDT", "USDC"];
