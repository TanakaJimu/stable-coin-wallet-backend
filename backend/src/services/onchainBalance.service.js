/**
 * On-chain ERC20 balance reads via ethers v6 (Polygon Amoy).
 * Uses AMOY_RPC_URL. Token addresses from tokenRegistry (AMOY_MOCK_USDT, etc.).
 */
import { JsonRpcProvider, Contract } from "ethers";
import { getTokenInfo } from "../utils/tokenRegistry.js";

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

let _provider = null;

function getProvider() {
  const url = process.env.AMOY_RPC_URL || process.env.BLOCKCHAIN_RPC_URL || process.env.RPC_URL;
  if (!url) throw new Error("AMOY_RPC_URL (or RPC_URL) must be set for on-chain balance");
  if (!_provider) _provider = new JsonRpcProvider(url);
  return _provider;
}

/**
 * Get ERC20 balance for one token.
 * @param {{ network: string, asset: string, address: string }}
 * @returns {Promise<{ asset: string, network: string, tokenAddress: string, raw: string, balance: number, decimals: number }>}
 */
export async function getErc20Balance({ network, asset, address }) {
  const info = getTokenInfo(asset, network);
  if (!info || !info.address) {
    throw new Error(`No token contract for ${asset} on ${network}. Set AMOY_MOCK_${asset} in .env.`);
  }
  const provider = getProvider();
  const contract = new Contract(info.address, ERC20_ABI, provider);
  const raw = await contract.balanceOf(address);
  const rawStr = String(raw);
  const decimals = Number(info.decimals);
  const balance = Number(raw) / Math.pow(10, decimals);
  return {
    asset: asset.toUpperCase(),
    network: String(network).toUpperCase(),
    tokenAddress: info.address,
    raw: rawStr,
    balance,
    decimals,
  };
}

/**
 * Get balances for multiple assets; one failure does not crash others (Promise.allSettled).
 * Only assets with a token contract in the registry are queried; others are skipped.
 * @param {{ network: string, assets: string[], address: string }}
 * @returns {Promise<Array<{ asset: string, network: string, tokenAddress: string, raw: string, balance: number, decimals: number } | { asset: string, error: string }>>}
 */
export async function getManyBalances({ network, assets, address }) {
  const networkNorm = String(network).toUpperCase();
  const results = await Promise.allSettled(
    (assets || []).map(async (asset) => {
      const info = getTokenInfo(asset, networkNorm);
      if (!info || !info.address) {
        return { asset: String(asset).toUpperCase(), error: `No token contract for ${asset}. Set AMOY_MOCK_${asset} in .env.` };
      }
      return getErc20Balance({ network: networkNorm, asset, address });
    })
  );
  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return { asset: String((assets || [])[i]).toUpperCase(), error: r.reason?.message || String(r.reason) };
  });
}
