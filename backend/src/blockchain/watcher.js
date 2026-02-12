/**
 * Subscribe to Vault Deposited events and sync to MongoDB (idempotent by txHash).
 * Run confirmations before crediting. Reconnect on disconnect.
 */
import { getProvider } from "./client.js";
import { loadDeployment } from "../config/loadDeployment.js";
import { getContracts } from "./contracts.js";
import mongoose from "mongoose";
import Transaction from "../models/transaction.js";
import Balance from "../models/balance.js";
import Wallet from "../models/wallet.js";

const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || "6", 10);
const REF_PREFIX = "w_"; // reference format: w_<walletId> for attribution

/**
 * Map token contract address (lowercase) to asset code for DB.
 */
function getAssetForToken(tokenAddress, deployment) {
  const c = deployment.contracts || {};
  const stable = (c.StableToken || c.StableCoinWallet || "").toLowerCase();
  const token = (tokenAddress || "").toLowerCase();
  if (token === stable) return process.env.STABLE_TOKEN_ASSET || "USDT";
  return "USDT"; // default
}

/**
 * Parse reference to walletId. Expects "w_<24-char hex or ObjectId>".
 */
function parseWalletIdFromReference(reference) {
  if (!reference || typeof reference !== "string") return null;
  const r = reference.trim();
  if (!r.startsWith(REF_PREFIX)) return null;
  const id = r.slice(REF_PREFIX.length).trim();
  if (id.length !== 24) return null;
  return mongoose.Types.ObjectId.isValid(id) ? id : null;
}

/**
 * Process a single Deposited event: wait for confirmations, then credit DB (idempotent by txHash).
 */
export async function processDepositEvent(event, deployment) {
  const txHash = event.log?.transactionHash || event.transactionHash;
  if (!txHash) return;
  const existing = await Transaction.findOne({ txHash });
  if (existing) return; // idempotent

  const provider = getProvider();
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || !receipt.blockNumber) return;
  const currentBlock = receipt.blockNumber;
  const latest = await provider.getBlockNumber();
  const confirmations = Number(latest - currentBlock);
  if (confirmations < CONFIRMATIONS) return; // wait for more confirmations

  const args = event.args || [];
  const userAddr = args.user ?? args[0];
  const tokenAddress = args.token ?? args[1];
  const amountRaw = args.amount ?? args[2];
  const reference = args.refId ?? args.reference ?? args[3];

  const walletId = parseWalletIdFromReference(reference);
  if (!walletId) return; // no wallet to credit
  const wallet = await Wallet.findById(walletId);
  if (!wallet) return;

  if (!tokenAddress || amountRaw === undefined) return;
  const amount = Number(amountRaw) / 1e18; // assume 18 decimals
  const asset = getAssetForToken(tokenAddress, deployment);

  await Balance.findOneAndUpdate(
    { walletId, asset },
    { $inc: { available: amount } },
    { upsert: true, new: true }
  );

  await Transaction.create({
    walletId,
    type: "RECEIVE",
    status: "COMPLETED",
    asset,
    network: "ERC20",
    amount,
    fromAddress: userAddr ?? null,
    toAddress: null,
    reference: reference ?? null,
    txHash,
    confirmations,
  });
}

/**
 * Start watching Vault Deposited events. Reconnects on disconnect.
 */
export async function startDepositWatcher(onError) {
  const deployment = loadDeployment();
  const { vault, deployment: dep } = getContracts({ write: false });
  if (!vault) {
    if (onError) onError(new Error("Vault not in deployment; watcher skipped"));
    return;
  }
  const provider = getProvider();
  const vaultAddress = await vault.getAddress();
  const filter = vault.filters.Deposited?.() ?? { address: vaultAddress, topics: [] };

  const processBlockRange = async (fromBlock, toBlock) => {
    const events = await vault.queryFilter(filter, fromBlock, toBlock);
    for (const e of events) {
      try {
        await processDepositEvent(e, dep);
      } catch (err) {
        if (onError) onError(err);
      }
    }
  };

  let lastProcessedBlock = await provider.getBlockNumber();
  const pollInterval = parseInt(process.env.WATCHER_POLL_MS || "12000", 10);

  const poll = async () => {
    try {
      const current = await provider.getBlockNumber();
      const from = lastProcessedBlock + 1;
      const to = Math.min(current - CONFIRMATIONS, from + 1999);
      if (from <= to) {
        await processBlockRange(from, to);
        lastProcessedBlock = to;
      }
    } catch (err) {
      if (onError) onError(err);
    }
    setTimeout(poll, pollInterval);
  };
  poll();
}
