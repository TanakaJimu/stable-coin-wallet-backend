/**
 * On-chain swap via Vault (operator). Uses router getAmountsOut for quote and amountOutMin with slippage.
 */
import { getContracts } from "./contracts.js";
import { getProvider } from "./client.js";
import { ethers } from "ethers";

const ROUTER_ABI = ["function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)"];

/**
 * Get expected amount out for a path. path = [fromTokenAddress, toTokenAddress] (or multi-hop).
 */
export async function getAmountsOut(amountInWei, path) {
  const { vault } = getContracts({ write: false });
  if (!vault) throw new Error("Vault not deployed");
  const routerAddr = await vault.router();
  if (!routerAddr || routerAddr === ethers.ZeroAddress) throw new Error("Vault router not set");
  const router = new ethers.Contract(routerAddr, ROUTER_ABI, getProvider());
  return router.getAmountsOut(amountInWei, path);
}

/**
 * Execute swap via Vault. Operator only. slippageBps e.g. 100 = 1%.
 */
export async function executeSwap(fromToken, toToken, amountInWei, slippageBps = 100, path) {
  const { vault } = getContracts({ write: true });
  if (!vault) throw new Error("Vault not deployed");
  const p = path || [fromToken, toToken];
  const amounts = await getAmountsOut(amountInWei, p);
  const last = amounts[amounts.length - 1];
  const amountOutMin = (last * (10000n - BigInt(slippageBps))) / 10000n;
  const deadline = Math.floor(Date.now() / 1000) + 300; // 5 min
  const tx = await vault.swap(fromToken, toToken, amountInWei, amountOutMin, deadline, p);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, amounts };
}
