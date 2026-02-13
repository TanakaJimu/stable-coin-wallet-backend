import Wallet from "../models/wallet.js";
import Balance from "../models/balance.js";
import Transaction from "../models/transaction.js";
import WalletAddress from "../models/walletAddressModel.js";
import { writeAuditLog } from "../middlewares/auditLog.js";
import { assertPositiveAmount, to2 } from "../utils/money.js";
import { SUPPORTED_ASSETS, SUPPORTED_NETWORKS } from "../utils/constants.js";
import { getTokenInfo, normalizeNetwork } from "../utils/tokenRegistry.js";
import { normAddress } from "../utils/chain.js";
import * as onchainVerification from "../services/onchainVerification.service.js";
import * as ledgerService from "../services/ledger.service.js";

const CHAIN_ID_AMOY = 80002;

/** Check if address belongs to user (any of user's wallets). Returns { walletId } or null. */
async function addressBelongsToUser(userId, address) {
  const wallets = await Wallet.find({ userId }).select("_id");
  const walletIds = wallets.map((w) => w._id);
  const wa = await WalletAddress.findOne({
    walletId: { $in: walletIds },
    address: normAddress(address) || address,
  });
  return wa ? { walletId: wa.walletId } : null;
}

/** Custodial: get Vault address + deposit reference (w_<walletId>) for attribution. Returns null if no Vault. */
async function getVaultReceiveInfo(walletId) {
  try {
    const { getContracts } = await import("../blockchain/contracts.js");
    const { vault } = getContracts({ write: false });
    if (!vault) return null;
    return { vaultAddress: vault.target, depositReference: `w_${walletId}` };
  } catch {
    return null;
  }
}

/** Get the user's default wallet, or their first wallet if none is default. */
async function getWalletOrThrow(userId) {
  let wallet = await Wallet.findOne({ userId, isDefault: true });
  if (!wallet) wallet = await Wallet.findOne({ userId }).sort({ createdAt: 1 });
  if (!wallet) throw new Error("Wallet not found");
  if (wallet.isLocked) throw new Error("Wallet locked");
  return wallet;
}

/**
 * Create another wallet for the current user.
 * Body: { name?: string, isDefault?: boolean }
 */
export async function createWallet(req, res) {
  try {
    const userId = req.user.id;
    const name = (req.body && req.body.name) ? String(req.body.name).trim() || "My Wallet" : "My Wallet";
    const setAsDefault = Boolean(req.body && req.body.isDefault);

    const existingCount = await Wallet.countDocuments({ userId });
    const wallet = await Wallet.create({
      userId,
      name: name || `Wallet ${existingCount + 1}`,
      isDefault: setAsDefault || existingCount === 0,
    });

    if (setAsDefault || existingCount === 0) {
      await Wallet.updateMany(
        { userId, _id: { $ne: wallet._id } },
        { $set: { isDefault: false } }
      );
    }

    await Promise.all(
      SUPPORTED_ASSETS.map((asset) =>
        Balance.updateOne(
          { walletId: wallet._id, asset },
          { $setOnInsert: { available: 0, locked: 0 } },
          { upsert: true }
        )
      )
    );

    await writeAuditLog({
      userId: req.user.id,
      action: "WALLET_CREATE",
      req,
      entityType: "wallet",
      entityId: wallet._id,
      meta: { name: wallet.name, isDefault: wallet.isDefault },
    });

    const balances = await Balance.find({ walletId: wallet._id }).sort({ asset: 1 });
    return res.status(201).json({
      message: "Wallet created",
      wallet,
      balances,
    });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
}

export async function listWallets(req, res) {
  try {
    const { page = 1, limit = 50 } = req.query;
    const p = Math.max(Number(page) || 1, 1);
    const l = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const skip = (p - 1) * l;

    const [items, total] = await Promise.all([
      Wallet.find().sort({ createdAt: -1 }).skip(skip).limit(l),
      Wallet.countDocuments(),
    ]);

    return res.json({
      page: p,
      limit: l,
      total,
      items,
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
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

/**
 * Add a new asset/currency balance to the user's wallet (e.g. add EUR if they don't have it yet).
 * Body: { asset: "EUR" } — must be one of SUPPORTED_ASSETS.
 */
export async function addAsset(req, res) {
  try {
    const wallet = await getWalletOrThrow(req.user.id);
    const raw = (req.body && req.body.asset) ? String(req.body.asset).toUpperCase().trim() : "";
    if (!raw) return res.status(400).json({ message: "asset is required" });
    if (!SUPPORTED_ASSETS.includes(raw)) {
      return res.status(400).json({
        message: "Unsupported asset",
        supported: SUPPORTED_ASSETS,
      });
    }

    const existing = await Balance.findOne({ walletId: wallet._id, asset: raw });
    if (existing) {
      return res.status(200).json({
        message: "Balance already exists for this asset",
        balance: existing,
      });
    }

    const balance = await Balance.create({
      walletId: wallet._id,
      asset: raw,
      available: 0,
      locked: 0,
    });

    await writeAuditLog({
      userId: req.user.id,
      action: "WALLET_ADD_ASSET",
      req,
      entityType: "balance",
      entityId: balance._id,
      meta: { asset: raw },
    });

    return res.status(201).json({ balance, message: "Wallet balance added" });
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

    // Custodial: return Vault address + deposit reference so watcher can attribute deposit to this wallet
    const vaultInfo = await getVaultReceiveInfo(wallet._id.toString());
    if (vaultInfo) {
      await writeAuditLog({
        userId: req.user.id,
        action: "WALLET_RECEIVE_ADDRESS_VIEW",
        req,
        entityType: "walletAddress",
        entityId: wallet._id,
        meta: { asset: A, network: N, custodial: true },
      });
      return res.json({
        address: vaultInfo.vaultAddress,
        depositReference: vaultInfo.depositReference,
        asset: A,
        network: N,
        custodial: true,
        message: "Use this address and reference when depositing; include reference in vault.deposit(..., reference)",
      });
    }

    // Non-custodial / fallback: return stored or placeholder address
    let addr = await WalletAddress.findOne({ walletId: wallet._id, asset: A, network: N, isDefault: true });
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
    const tokenInfo = getTokenInfo(A, N);
    const out = addr.toObject ? addr.toObject() : addr;
    if (tokenInfo?.tokenAddress) out.tokenAddress = tokenInfo.tokenAddress;
    return res.json(out);
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
}

export async function topup(req, res) {
  try {
    const wallet = await getWalletOrThrow(req.user.id);
    const { asset, amount, network, reference, fromAddress, toAddress, txHash: bodyTxHash } = req.body;

    const A = String(asset || "").toUpperCase();
    const N = normalizeNetwork(network || "TRC20");
    if (!SUPPORTED_ASSETS.includes(A)) return res.status(400).json({ message: "Unsupported asset" });
    if (!SUPPORTED_NETWORKS.includes(N)) return res.status(400).json({ message: "Unsupported network" });

    const amt = assertPositiveAmount(amount);

    // --- On-chain mode: client submits txHash, we verify then credit ---
    if (bodyTxHash && String(bodyTxHash).trim().startsWith("0x")) {
      const existing = await Transaction.findOne({ txHash: String(bodyTxHash).trim().toLowerCase() });
      if (existing) return res.status(409).json({ message: "Transaction already processed", txHash: bodyTxHash, mode: "onchain" });
      const toAddr = toAddress || (await WalletAddress.findOne({ walletId: wallet._id, asset: A, network: N, isDefault: true }))?.address;
      if (!toAddr) return res.status(400).json({ message: "toAddress required for on-chain topup" });
      const belongs = await addressBelongsToUser(req.user.id, toAddr);
      if (!belongs || belongs.walletId.toString() !== wallet._id.toString()) return res.status(403).json({ message: "toAddress does not belong to this user" });
      try {
        const info = getTokenInfo(A, N);
        await onchainVerification.verifyDeposit({ network: N, asset: A, txHash: bodyTxHash, toAddress: toAddr, amount: amt, decimals: info?.decimals });
      } catch (err) {
        return res.status(400).json({ message: "Verification failed", error: err.message });
      }
      const bal = await ledgerService.creditBalance(wallet._id, A, amt);
      const tx = await Transaction.create({
        userId: req.user._id || req.user.id,
        walletId: wallet._id,
        type: "TOPUP",
        status: "COMPLETED",
        asset: A,
        network: N,
        amount: amt,
        toAddress: toAddr,
        reference: reference || null,
        txHash: String(bodyTxHash).trim().toLowerCase(),
        chainId: CHAIN_ID_AMOY,
      });
      await writeAuditLog({ userId: req.user.id, action: "TOPUP_ONCHAIN", req, entityType: "transaction", entityId: tx._id, meta: { asset: A, amount: amt, txHash: bodyTxHash }, walletId: wallet._id });
      return res.status(201).json({ balance: bal, tx, mode: "onchain" });
    }

    // --- Off-chain mode: mint (if contract) or ledger credit only ---
    let txHash = null;
    try {
      const { ethers: e } = await import("ethers");
      const { getContracts, getTokenForAsset } = await import("../blockchain/contracts.js");
      const { getSigner } = await import("../blockchain/client.js");
      const contracts = getContracts({ write: true });
      const tokenInfo = getTokenForAsset(contracts, A);
      if (tokenInfo) {
        const signer = getSigner();
        if (signer) {
          const mintTo = toAddress && e.isAddress(toAddress) ? toAddress : signer.address;
          const amountWei = BigInt(Math.floor(amt * 10 ** tokenInfo.decimals));
          const mintTx = await tokenInfo.contract.mint(mintTo, amountWei);
          const receipt = await mintTx.wait();
          txHash = receipt.hash;
        }
      }
    } catch (_) {}
    const bal = await Balance.findOneAndUpdate(
      { walletId: wallet._id, asset: A },
      { $inc: { available: amt } },
      { new: true }
    );
    const tx = await Transaction.create({
      userId: req.user._id || req.user.id,
      walletId: wallet._id,
      type: "TOPUP",
      status: "COMPLETED",
      asset: A,
      network: N,
      amount: amt,
      fromAddress: fromAddress || null,
      toAddress: toAddress || null,
      reference: reference || null,
      txHash: txHash || undefined,
    });
    await writeAuditLog({ userId: req.user.id, action: "WALLET_TOPUP_COMPLETED", req, entityType: "transaction", entityId: tx._id, meta: { asset: A, amount: amt, network: N } });
    return res.status(201).json({ balance: bal, tx, mode: "offchain" });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
}

export async function receive(req, res) {
  // In real life: this comes from webhook / chain listener.
  // For now: it’s a manual ledger credit endpoint.
  try {
    const wallet = await getWalletOrThrow(req.user.id);
    const { asset, amount, network, fromAddress, memo, reference, toAddress, txHash: bodyTxHash } = req.body;

    const A = String(asset || "").toUpperCase();
    const N = normalizeNetwork(network || "TRC20");
    if (!SUPPORTED_ASSETS.includes(A)) return res.status(400).json({ message: "Unsupported asset" });
    if (!SUPPORTED_NETWORKS.includes(N)) return res.status(400).json({ message: "Unsupported network" });

    const amt = assertPositiveAmount(amount);

    if (bodyTxHash && String(bodyTxHash).trim().startsWith("0x")) {
      const existing = await Transaction.findOne({ txHash: String(bodyTxHash).trim().toLowerCase() });
      if (existing) return res.status(409).json({ message: "Transaction already processed", txHash: bodyTxHash, mode: "onchain" });
      const toAddr = toAddress || (await WalletAddress.findOne({ walletId: wallet._id, asset: A, network: N, isDefault: true }))?.address;
      if (!toAddr) return res.status(400).json({ message: "toAddress required for on-chain receive" });
      const belongs = await addressBelongsToUser(req.user.id, toAddr);
      if (!belongs || belongs.walletId.toString() !== wallet._id.toString()) return res.status(403).json({ message: "toAddress does not belong to this user" });
      try {
        const info = getTokenInfo(A, N);
        await onchainVerification.verifyDeposit({ network: N, asset: A, txHash: bodyTxHash, toAddress: toAddr, amount: amt, decimals: info?.decimals ?? 6 });
      } catch (err) {
        return res.status(400).json({ message: "Verification failed", error: err.message });
      }
      const bal = await ledgerService.creditBalance(wallet._id, A, amt);
      const tx = await Transaction.create({
        userId: req.user._id || req.user.id,
        walletId: wallet._id,
        type: "RECEIVE",
        status: "COMPLETED",
        asset: A,
        network: N,
        amount: amt,
        fromAddress: fromAddress || null,
        toAddress: toAddr,
        memo: memo || null,
        reference: reference || null,
        txHash: String(bodyTxHash).trim().toLowerCase(),
        chainId: CHAIN_ID_AMOY,
      });
      await writeAuditLog({ userId: req.user.id, action: "WALLET_RECEIVE_CREDIT", req, entityType: "transaction", entityId: tx._id, meta: { asset: A, amount: amt, txHash: bodyTxHash }, walletId: wallet._id });
      return res.status(201).json({ balance: bal, tx, mode: "onchain" });
    }

    const bal = await Balance.findOneAndUpdate(
      { walletId: wallet._id, asset: A },
      { $inc: { available: amt } },
      { new: true }
    );
    const tx = await Transaction.create({
      userId: req.user._id || req.user.id,
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
    await writeAuditLog({ userId: req.user.id, action: "WALLET_RECEIVE_CREDIT", req, entityType: "transaction", entityId: tx._id, meta: { asset: A, amount: amt, network: N } });
    return res.status(201).json({ balance: bal, tx, mode: "offchain" });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
}

export async function send(req, res) {
  try {
    const wallet = await getWalletOrThrow(req.user.id);
    const { asset, amount, network, toAddress, memo, fee = 0, fromAddress, txHash: bodyTxHash } = req.body;

    const A = String(asset || "").toUpperCase();
    const N = normalizeNetwork(network || "TRC20");
    if (!SUPPORTED_ASSETS.includes(A)) return res.status(400).json({ message: "Unsupported asset" });
    if (!SUPPORTED_NETWORKS.includes(N)) return res.status(400).json({ message: "Unsupported network" });
    if (!toAddress) return res.status(400).json({ message: "toAddress required" });

    const amt = assertPositiveAmount(amount);
    const f = to2(fee);
    const totalDebit = to2(amt + f);

    if (bodyTxHash && String(bodyTxHash).trim().startsWith("0x")) {
      const existing = await Transaction.findOne({ txHash: String(bodyTxHash).trim().toLowerCase() });
      if (existing) return res.status(409).json({ message: "Transaction already processed", txHash: bodyTxHash, mode: "onchain" });
      if (!fromAddress) return res.status(400).json({ message: "fromAddress required for on-chain send" });
      const belongs = await addressBelongsToUser(req.user.id, fromAddress);
      if (!belongs || belongs.walletId.toString() !== wallet._id.toString()) return res.status(403).json({ message: "fromAddress does not belong to this user" });
      const bal = await Balance.findOne({ walletId: wallet._id, asset: A });
      if (!bal) return res.status(404).json({ message: "Balance not found" });
      if (bal.available < totalDebit) return res.status(400).json({ message: "Insufficient balance" });
      try {
        const info = getTokenInfo(A, N);
        await onchainVerification.verifySend({ network: N, asset: A, txHash: bodyTxHash, fromAddress, toAddress, amount: amt, decimals: info?.decimals ?? 6 });
      } catch (err) {
        return res.status(400).json({ message: "Verification failed", error: err.message });
      }
      const updated = await ledgerService.debitBalance(wallet._id, A, totalDebit);
      const tx = await Transaction.create({
        userId: req.user._id || req.user.id,
        walletId: wallet._id,
        type: "SEND",
        status: "COMPLETED",
        asset: A,
        network: N,
        amount: amt,
        fee: f,
        fromAddress,
        toAddress,
        memo: memo || null,
        txHash: String(bodyTxHash).trim().toLowerCase(),
        chainId: CHAIN_ID_AMOY,
      });
      await writeAuditLog({ userId: req.user.id, action: "SEND_ONCHAIN", req, entityType: "transaction", entityId: tx._id, meta: { asset: A, amount: amt, toAddress, txHash: bodyTxHash }, walletId: wallet._id });
      return res.status(201).json({ balance: updated, tx, mode: "onchain" });
    }

    const bal = await Balance.findOne({ walletId: wallet._id, asset: A });
    if (!bal) return res.status(404).json({ message: "Balance not found" });
    if (bal.available < totalDebit) return res.status(400).json({ message: "Insufficient balance" });
    bal.available = to2(bal.available - totalDebit);
    await bal.save();
    let txHash = null;
    try {
      const { getContracts, getTokenForAsset } = await import("../blockchain/contracts.js");
      const contracts = getContracts({ write: true });
      const { vault, deployment } = contracts;
      const tokenInfo = getTokenForAsset(contracts, A);
      const tokenAddress = deployment.contracts?.StableToken || deployment.contracts?.StableCoinWallet || (A === "USDT" && deployment.contracts?.MockUSDT) || (A === "USDC" && deployment.contracts?.MockUSDC);
      const decimals = tokenInfo?.decimals ?? 18;
      if (vault && tokenAddress) {
        const { ethers: e } = await import("ethers");
        const amountWei = e.parseUnits(String(amt), decimals);
        const ref = `send_${wallet._id}_${Date.now()}`;
        const tx = await vault.withdrawTo(tokenAddress, toAddress, amountWei, ref);
        const receipt = await tx.wait();
        txHash = receipt.hash;
      }
    } catch (_) {}
    const tx = await Transaction.create({
      userId: req.user._id || req.user.id,
      walletId: wallet._id,
      type: "SEND",
      status: "COMPLETED",
      asset: A,
      network: N,
      amount: amt,
      fee: f,
      toAddress,
      memo: memo || null,
      txHash: txHash || undefined,
    });
    await writeAuditLog({ userId: req.user.id, action: "WALLET_SEND_COMPLETED", req, entityType: "transaction", entityId: tx._id, meta: { asset: A, amount: amt, network: N, toAddress } });
    return res.status(201).json({ balance: bal, tx, mode: "offchain" });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
}

export async function swap(req, res) {
  try {
    const wallet = await getWalletOrThrow(req.user.id);
    const { fromAsset, toAsset, amount, rate = 1.0, fee = 0, network, txHash: bodyTxHash, userAddress: bodyUserAddress } = req.body;

    const F = String(fromAsset || "").toUpperCase();
    const T = String(toAsset || "").toUpperCase();
    const N = normalizeNetwork(network || "POLYGON_AMOY");
    if (!SUPPORTED_ASSETS.includes(F) || !SUPPORTED_ASSETS.includes(T)) {
      return res.status(400).json({ message: "Unsupported asset" });
    }
    if (F === T) return res.status(400).json({ message: "fromAsset and toAsset must differ" });

    const amt = assertPositiveAmount(amount);
    const r = Number(rate);
    if (!Number.isFinite(r) || r <= 0) return res.status(400).json({ message: "Invalid rate" });
    const f = to2(fee);
    const decimals = getTokenInfo(F, N)?.decimals ?? 6;

    if (bodyTxHash && String(bodyTxHash).trim().startsWith("0x")) {
      const existing = await Transaction.findOne({ txHash: String(bodyTxHash).trim().toLowerCase() });
      if (existing) return res.status(409).json({ message: "Transaction already processed", txHash: bodyTxHash, mode: "onchain" });
      const userAddr = bodyUserAddress || (await WalletAddress.findOne({ walletId: wallet._id, asset: F, network: N, isDefault: true }))?.address
        || (await WalletAddress.findOne({ walletId: wallet._id, network: N }))?.address;
      if (!userAddr) return res.status(400).json({ message: "userAddress or stored wallet address required for on-chain swap" });
      const belongs = await addressBelongsToUser(req.user.id, userAddr);
      if (!belongs || belongs.walletId.toString() !== wallet._id.toString()) return res.status(403).json({ message: "userAddress does not belong to this user" });
      let swapResult;
      try {
        swapResult = await onchainVerification.verifyMockSwap({ txHash: bodyTxHash, userAddress: userAddr, fromAsset: F, toAsset: T, amount: amt, decimals });
      } catch (err) {
        return res.status(400).json({ message: "Verification failed", error: err.message });
      }
      const { ethers: e } = await import("ethers");
      const amountInHuman = Number(e.formatUnits(swapResult.amountIn, decimals));
      const amountOutHuman = Number(e.formatUnits(swapResult.amountOut, decimals));
      const feeHuman = Number(e.formatUnits(swapResult.fee, decimals));
      // Fee already reflected in amountOut (amountOut = amountIn - fee on-chain)
      const { fromBalance, toBalance } = await ledgerService.swapBalance(wallet._id, F, T, amountInHuman, amountOutHuman, 0);
      const tx = await Transaction.create({
        userId: req.user._id || req.user.id,
        walletId: wallet._id,
        type: "SWAP",
        status: "COMPLETED",
        amount: amountInHuman,
        fromAsset: F,
        toAsset: T,
        rate: amountOutHuman / amountInHuman,
        fee: to2(feeHuman),
        network: N,
        txHash: String(bodyTxHash).trim().toLowerCase(),
        chainId: CHAIN_ID_AMOY,
        meta: { amountOut: amountOutHuman },
      });
      await writeAuditLog({ userId: req.user.id, action: "WALLET_SWAP_COMPLETED", req, entityType: "transaction", entityId: tx._id, meta: { fromAsset: F, toAsset: T, txHash: bodyTxHash }, walletId: wallet._id });
      return res.status(201).json({ fromBalance, toBalance, tx, mode: "onchain" });
    }

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
      userId: req.user._id || req.user.id,
      walletId: wallet._id,
      type: "SWAP",
      status: "COMPLETED",
      amount: amt,
      fromAsset: F,
      toAsset: T,
      rate: r,
      fee: f,
    });
    await writeAuditLog({ userId: req.user.id, action: "WALLET_SWAP_COMPLETED", req, entityType: "transaction", entityId: tx._id, meta: { fromAsset: F, toAsset: T, amount: amt, rate: r, fee: f } });
    return res.status(201).json({
      fromBalance: fromBal,
      toBalance: toBal,
      tx,
      mode: "offchain",
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
