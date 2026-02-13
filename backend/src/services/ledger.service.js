/**
 * Ledger service: credit/debit/swap balance for a wallet.
 */
import Balance from "../models/balance.js";

function to2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Credit balance (increase available).
 */
export async function creditBalance(walletId, asset, amount) {
  const amt = to2(amount);
  const bal = await Balance.findOneAndUpdate(
    { walletId, asset: String(asset).toUpperCase() },
    { $inc: { available: amt } },
    { upsert: true, new: true }
  );
  return bal;
}

/**
 * Debit balance (decrease available). Throws if insufficient.
 */
export async function debitBalance(walletId, asset, amount) {
  const amt = to2(amount);
  const bal = await Balance.findOne({ walletId, asset: String(asset).toUpperCase() });
  if (!bal) throw new Error("Balance not found");
  if (bal.available < amt) throw new Error("Insufficient balance");
  bal.available = to2(bal.available - amt);
  await bal.save();
  return bal;
}

/**
 * Swap: debit fromAsset by amountIn (optionally + fee), credit toAsset by amountOut.
 */
export async function swapBalance(walletId, fromAsset, toAsset, amountIn, amountOut, fee = 0) {
  const totalDebit = to2(amountIn + fee);
  await debitBalance(walletId, fromAsset, totalDebit);
  const toBal = await creditBalance(walletId, toAsset, amountOut);
  const fromBal = await Balance.findOne({ walletId, asset: String(fromAsset).toUpperCase() });
  return { fromBalance: fromBal, toBalance: toBal };
}
