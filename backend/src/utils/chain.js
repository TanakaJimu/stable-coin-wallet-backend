/**
 * Chain utils (ethers v6): provider, address helpers, ERC20 Transfer ABI.
 */
import { ethers } from "ethers";

const AMOY_CHAIN_ID = 80002;

export function getProvider(network) {
  const rpc = process.env.AMOY_RPC_URL || process.env.BLOCKCHAIN_RPC_URL || process.env.RPC_URL;
  if (!rpc) throw new Error("AMOY_RPC_URL or RPC_URL required");
  return new ethers.JsonRpcProvider(rpc);
}

export function normAddress(addr) {
  if (!addr || typeof addr !== "string") return "";
  return addr.toLowerCase().trim();
}

export function isSameAddress(a, b) {
  return normAddress(a) === normAddress(b);
}

/**
 * Parse human amount to bigint with given decimals.
 */
export function parseAmount(amount, decimals) {
  const d = Number(decimals);
  if (!Number.isFinite(d) || d < 0) throw new Error("Invalid decimals");
  const amt = Number(amount);
  if (!Number.isFinite(amt)) throw new Error("Invalid amount");
  return BigInt(Math.floor(amt * 10 ** d));
}

/**
 * ERC20 Transfer(address indexed from, address indexed to, uint256 value)
 */
export const ERC20_TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

/**
 * Decode Transfer log (topics[0]=Transfer, topics[1]=from, topics[2]=to, data=value).
 */
export function decodeTransferLog(log) {
  if (!log || !log.topics || log.topics[0] !== ERC20_TRANSFER_TOPIC) return null;
  const from = log.topics[1] ? ethers.getAddress("0x" + log.topics[1].slice(26)) : null;
  const to = log.topics[2] ? ethers.getAddress("0x" + log.topics[2].slice(26)) : null;
  const value = log.data && log.data !== "0x" ? BigInt(log.data) : 0n;
  return { from, to, value };
}

/**
 * MockSwap Swap event: Swap(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 fee)
 */
export const MOCK_SWAP_SWAP_TOPIC = ethers.id(
  "Swap(address,address,address,uint256,uint256,uint256)"
);

/**
 * ERC721 Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
 */
export const ERC721_TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

/**
 * Decode ERC721 Transfer log (mint: from = 0x0). Returns { from, to, tokenId }.
 */
export function decodeERC721TransferLog(log) {
  if (!log || !log.topics || log.topics[0] !== ERC721_TRANSFER_TOPIC) return null;
  const from = log.topics[1] ? ethers.getAddress("0x" + log.topics[1].slice(26)) : null;
  const to = log.topics[2] ? ethers.getAddress("0x" + log.topics[2].slice(26)) : null;
  const tokenId = log.topics[3] ? BigInt(log.topics[3]) : null;
  return { from, to, tokenId };
}

export const AMOY_CHAIN_ID_NUM = AMOY_CHAIN_ID;
