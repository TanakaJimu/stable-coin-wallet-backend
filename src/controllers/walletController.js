import Wallet from "../models/wallet.model.js";
import Balance from "../models/balance.model.js";
import Transaction from "../models/transaction.model.js";
import WalletAddress from "../models/walletAddress.model.js";
import { writeAuditLog } from "../middlewares/auditLog.js";
import { assertPositiveAmount, to2 } from "../utils/money.js";
import { SUPPORTED_ASSETS, SUPPORTED_NETWORKS } from "../utils/constants.js";

async function getWalletOrThrow(userId) {
  const wallet = await Wallet.findOne({ userId });
  if (!wallet) throw new Error("Wallet not found");
  if (wallet.isLocked) throw new Error("Wallet locked");
  return wallet;
}

export async function getSummary(req, res) {
  try {
    const wallet = await getWalletOrThrow(req.user.id);
    const balances = await Balance.find({ walletId: wallet._id }).sort({ asset: 1 });
    return res.json({ walletId: wallet._id, balances });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
}

export async function getReceiveAddress(req, res) {
  try {
    const wallet = await getWalletOrThrow(req.user.id);
    const { asset = "USDT", network = "TRC20" } = req.query;

    const A = String(asset).toUpperCase();
    const N = String(network).toUpperCase();

    if (!SUPPORTED_ASSETS.includes(A)) return res.status(400).json({ message: "Unsupported asset" });
    if (!SUPPORTED_NETWORKS.includes(N)) return res.status(400).json({ message: "Unsupported network" });

    // for now: return default address if exists
    let addr = await WalletAddress.findOne({ walletId: wallet._id, asset: A, network: N, isDefault: true });

    // if none, create a fake placeholder (replace later with real address generator)
    if (!addr) {
      addr = await WalletAddress.create({
        walletId: wallet._id,
        asset: A,
        network: N,
        address: `demo_${A}_${N}_${wallet._id.toString().slice(-6)}`,
        isDefault: true,
      });
    }

    await writeAuditLog({
      userId: req.user.id,
      action: "WALLET_RECEIVE_ADDRESS_VIEW",
      req,
      entityType: "walletAddress",
      entityId: addr._id,
      meta: { asset: A, network: N },
    });

    return res.json(addr);
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
}

export async function topup(req, res) {
  try {
    const wallet = await getWalletOrThrow(req.user.id);
    const { asset, amount, network, reference } = req.body;

    const A = String(asset || "").toUpperCase();
    const N = String(network || "TRC20").toUpperCase();
    if (!SUPPORTED_ASSETS.includes(A)) return res.status(400).json({ message: "Unsupported asset" });
    if (!SUPPORTED_NETWORKS.includes(N)) return res.status(400).json({ message: "Unsupported network" });

    const amt = assertPositiveAmount(amount);

    const bal = await Balance.findOneAndUpdate(
      { walletId: wallet._id, asset: A },
      { $inc: { available: amt } },
      { new: true }
    );

    const tx = await Transaction.create({
      walletId: wallet._id,
      type: "TOPUP",
      status: "COMPLETED",
      asset: A,
      network: N,
      amount: amt,
      reference: reference || null,
    });

    await writeAuditLog({
      userId: req.user.id,
      action: "WALLET_TOPUP_COMPLETED",
      req,
      entityType: "transaction",
      entityId: tx._id,
      meta: { asset: A, amount: amt, network: N },
    });

    return res.status(201).json({ balance: bal, tx });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
}

export async function receive(req, res) {
  // In real life: this comes from webhook / chain listener.
  // For now: it’s a manual ledger credit endpoint.
  try {
    const wallet = await getWalletOrThrow(req.user.id);
    const { asset, amount, network, fromAddress, memo, reference } = req.body;

    const A = String(asset || "").toUpperCase();
    const N = String(network || "TRC20").toUpperCase();
    if (!SUPPORTED_ASSETS.includes(A)) return res.status(400).json({ message: "Unsupported asset" });
    if (!SUPPORTED_NETWORKS.includes(N)) return res.status(400).json({ message: "Unsupported network" });

    const amt = assertPositiveAmount(amount);

    const bal = await Balance.findOneAndUpdate(
      { walletId: wallet._id, asset: A },
      { $inc: { available: amt } },
      { new: true }
    );

    const tx = await Transaction.create({
      walletId: wallet._id,
      type: "RECEIVE",
      status: "COMPLETED",
      asset: A,
      network: N,
      amount: amt,
      fromAddress: fromAddress || null,
      memo: memo || null,
      reference: reference || null,
    });

    await writeAuditLog({
      userId: req.user.id,
      action: "WALLET_RECEIVE_CREDIT",
      req,
      entityType: "transaction",
      entityId: tx._id,
      meta: { asset: A, amount: amt, network: N },
    });

    return res.status(201).json({ balance: bal, tx });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
}

export async function send(req, res) {
  try {
    const wallet = await getWalletOrThrow(req.user.id);
    const { asset, amount, network, toAddress, memo, fee = 0 } = req.body;

    const A = String(asset || "").toUpperCase();
    const N = String(network || "TRC20").toUpperCase();
    if (!SUPPORTED_ASSETS.includes(A)) return res.status(400).json({ message: "Unsupported asset" });
    if (!SUPPORTED_NETWORKS.includes(N)) return res.status(400).json({ message: "Unsupported network" });
    if (!toAddress) return res.status(400).json({ message: "toAddress required" });

    const amt = assertPositiveAmount(amount);
    const f = to2(fee);

    const bal = await Balance.findOne({ walletId: wallet._id, asset: A });
    if (!bal) return res.status(404).json({ message: "Balance not found" });

    const totalDebit = to2(amt + f);
    if (bal.available < totalDebit) return res.status(400).json({ message: "Insufficient balance" });

    bal.available = to2(bal.available - totalDebit);
    await bal.save();

    const tx = await Transaction.create({
      walletId: wallet._id,
      type: "SEND",
      status: "COMPLETED",
      asset: A,
      network: N,
      amount: amt,
      fee: f,
      toAddress,
      memo: memo || null,
    });

    await writeAuditLog({
      userId: req.user.id,
      action: "WALLET_SEND_COMPLETED",
      req,
      entityType: "transaction",
      entityId: tx._id,
      meta: { asset: A, amount: amt, network: N, toAddress },
    });

    return res.status(201).json({ balance: bal, tx });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
}

export async function swap(req, res) {
  // Ledger swap: debit fromAsset, credit toAsset
  try {
    const wallet = await getWalletOrThrow(req.user.id);
    const { fromAsset, toAsset, amount, rate = 1.0, fee = 0 } = req.body;

    const F = String(fromAsset || "").toUpperCase();
    const T = String(toAsset || "").toUpperCase();
    if (!SUPPORTED_ASSETS.includes(F) || !SUPPORTED_ASSETS.includes(T)) {
      return res.status(400).json({ message: "Unsupported asset" });
    }
    if (F === T) return res.status(400).json({ message: "fromAsset and toAsset must differ" });

    const amt = assertPositiveAmount(amount);
    const r = Number(rate);
    if (!Number.isFinite(r) || r <= 0) return res.status(400).json({ message: "Invalid rate" });

    const f = to2(fee);

    const fromBal = await Balance.findOne({ walletId: wallet._id, asset: F });
    const toBal = await Balance.findOne({ walletId: wallet._id, asset: T });

    if (!fromBal || !toBal) return res.status(404).json({ message: "Balance not found" });

    const totalDebit = to2(amt + f);
    if (fromBal.available < totalDebit) return res.status(400).json({ message: "Insufficient balance" });

    const credit = to2(amt * r);

    fromBal.available = to2(fromBal.available - totalDebit);
    toBal.available = to2(toBal.available + credit);

    await fromBal.save();
    await toBal.save();

    const tx = await Transaction.create({
      walletId: wallet._id,
      type: "SWAP",
      status: "COMPLETED",
      amount: amt,
      fromAsset: F,
      toAsset: T,
      rate: r,
      fee: f,
    });

    await writeAuditLog({
      userId: req.user.id,
      action: "WALLET_SWAP_COMPLETED",
      req,
      entityType: "transaction",
      entityId: tx._id,
      meta: { fromAsset: F, toAsset: T, amount: amt, rate: r, fee: f },
    });

    return res.status(201).json({
      fromBalance: fromBal,
      toBalance: toBal,
      tx,
      credited: credit,
    });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
}

export async function history(req, res) {
  try {
    const wallet = await getWalletOrThrow(req.user.id);
    const { limit = 30 } = req.query;
    const items = await Transaction.find({ walletId: wallet._id })
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 30, 100));
    return res.json(items);
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
}
