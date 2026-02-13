/**
 * On-chain verification: verify tx receipt and ERC20 Transfer / MockSwap events.
 */
import { getProvider, normAddress, isSameAddress, decodeTransferLog, decodeERC721TransferLog, ERC20_TRANSFER_TOPIC, ERC721_TRANSFER_TOPIC, AMOY_CHAIN_ID_NUM } from "../utils/chain.js";
import { getTokenInfo } from "../utils/tokenRegistry.js";
import { ethers } from "ethers";

let _provider = null;
function getProviderInstance() {
  if (!_provider) _provider = getProvider("POLYGON_AMOY");
  return _provider;
}

/**
 * Verify tx exists, receipt status success, correct chain.
 */
export async function verifyTxReceipt(txHash) {
  const hash = normAddress(txHash);
  if (!hash || !hash.startsWith("0x") || hash.length !== 66) throw new Error("Invalid txHash");
  const provider = getProviderInstance();
  const receipt = await provider.getTransactionReceipt(hash);
  if (!receipt) throw new Error("Transaction not found");
  if (receipt.status !== 1) throw new Error("Transaction failed");
  const chainId = (await provider.getNetwork()).chainId;
  if (Number(chainId) !== AMOY_CHAIN_ID_NUM) throw new Error("Wrong chain");
  return receipt;
}

/**
 * Verify ERC20 Transfer log: log.address == tokenAddress, optional from/to/amount checks.
 * @returns { from, to, value } from the matching Transfer log
 */
export async function verifyErc20Transfer({
  network,
  tokenAddress,
  txHash,
  expectedFrom = null,
  expectedTo = null,
  expectedAmount = null,
}) {
  const receipt = await verifyTxReceipt(txHash);
  const token = normAddress(tokenAddress);
  const transferLog = receipt.logs.find(
    (log) => normAddress(log.address) === token && log.topics && log.topics[0] === ERC20_TRANSFER_TOPIC
  );
  if (!transferLog) throw new Error("Transfer log not found for token");
  const decoded = decodeTransferLog(transferLog);
  if (!decoded) throw new Error("Invalid Transfer log");
  if (expectedFrom != null && !isSameAddress(decoded.from, expectedFrom)) throw new Error("Transfer from mismatch");
  if (expectedTo != null && !isSameAddress(decoded.to, expectedTo)) throw new Error("Transfer to mismatch");
  if (expectedAmount != null && decoded.value !== BigInt(expectedAmount)) throw new Error("Transfer amount mismatch");
  return { from: decoded.from, to: decoded.to, value: decoded.value };
}

/**
 * Verify deposit: expectedTo is user's deposit address; token/amount match.
 */
export async function verifyDeposit({ network, asset, txHash, toAddress, amount, decimals }) {
  const info = getTokenInfo(asset, network);
  if (!info || !info.tokenAddress) throw new Error("Unsupported asset/network for on-chain");
  const expectedAmount = BigInt(Math.floor(Number(amount) * 10 ** (decimals ?? info.decimals)));
  return verifyErc20Transfer({
    network,
    tokenAddress: info.tokenAddress,
    txHash,
    expectedTo: toAddress,
    expectedAmount,
  });
}

/**
 * Verify send: expectedFrom belongs to user; token/to/amount match.
 */
export async function verifySend({ network, asset, txHash, fromAddress, toAddress, amount, decimals }) {
  const info = getTokenInfo(asset, network);
  if (!info || !info.tokenAddress) throw new Error("Unsupported asset/network for on-chain");
  const expectedAmount = BigInt(Math.floor(Number(amount) * 10 ** (decimals ?? info.decimals)));
  return verifyErc20Transfer({
    network,
    tokenAddress: info.tokenAddress,
    txHash,
    expectedFrom: fromAddress,
    expectedTo: toAddress,
    expectedAmount,
  });
}

/**
 * Verify MockSwap event from MOCK_SWAP_ADDRESS. Returns { user, tokenIn, tokenOut, amountIn, amountOut, fee }.
 */
export async function verifyMockSwap({ txHash, userAddress, fromAsset, toAsset, amount, decimals = 6 }) {
  const receipt = await verifyTxReceipt(txHash);
  const swapAddress = process.env.MOCK_SWAP_ADDRESS;
  if (!swapAddress) throw new Error("MOCK_SWAP_ADDRESS not configured");
  const swapAddr = normAddress(swapAddress);
  // Swap(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 fee)
  const swapLog = receipt.logs.find((log) => normAddress(log.address) === swapAddr);
  if (!swapLog || !swapLog.topics || swapLog.topics.length < 1) throw new Error("Swap event not found");
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const expectedAmountIn = BigInt(Math.floor(Number(amount) * 10 ** decimals));
  const userFromTopic = swapLog.topics[1] ? ethers.getAddress("0x" + swapLog.topics[1].slice(26)) : null;
  if (userAddress && !isSameAddress(userFromTopic, userAddress)) throw new Error("Swap user mismatch");
  if (swapLog.data && swapLog.data !== "0x") {
    const decoded = abiCoder.decode(
      ["address", "address", "uint256", "uint256", "uint256"],
      swapLog.data
    );
    const [tokenIn, tokenOut, amountIn, amountOut, fee] = decoded;
    if (amountIn !== expectedAmountIn) throw new Error("Swap amountIn mismatch");
    return {
      user: userFromTopic,
      tokenIn,
      tokenOut,
      amountIn,
      amountOut,
      fee,
    };
  }
  throw new Error("Swap log data missing");
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Verify NFT mint: tx contains ERC721 Transfer(from=0, to=owner, tokenId) from nftContractAddress.
 * @param {{ txHash: string, nftContractAddress: string, expectedTo?: string }}
 * @returns {{ tokenId: bigint, to: string }}
 */
export async function verifyNftMint({ txHash, nftContractAddress, expectedTo = null }) {
  const receipt = await verifyTxReceipt(txHash);
  const nftAddr = normAddress(nftContractAddress);
  const mintLog = receipt.logs.find(
    (log) =>
      normAddress(log.address) === nftAddr &&
      log.topics &&
      log.topics[0] === ERC721_TRANSFER_TOPIC
  );
  if (!mintLog) throw new Error("NFT Transfer (mint) log not found");
  const decoded = decodeERC721TransferLog(mintLog);
  if (!decoded) throw new Error("Invalid ERC721 Transfer log");
  if (decoded.from !== null && !isSameAddress(decoded.from, ZERO_ADDRESS)) {
    throw new Error("Not a mint (from must be zero)");
  }
  if (expectedTo != null && !isSameAddress(decoded.to, expectedTo)) {
    throw new Error("Mint recipient mismatch");
  }
  return { tokenId: decoded.tokenId, to: decoded.to };
}
