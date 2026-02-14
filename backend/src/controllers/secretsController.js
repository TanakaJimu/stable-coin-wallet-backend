import UserSecret from "../models/userSecret.js";
import Wallet from "../models/wallet.js";
import HDWalletSecret from "../models/hdWalletSecret.model.js";
import Balance from "../models/balance.js";
import { SUPPORTED_ASSETS, SUPPORTED_NETWORKS } from "../utils/constants.js";
import { writeAuditLog } from "../middlewares/auditLog.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError, asyncHandler } from "../utils/apiError.js";
import { encrypt, decrypt } from "../utils/encryption.js";
import {
  getOrCreateUserMnemonic,
  deriveNewAddressForUser,
  getPrivateKeyForDerivedAddress,
} from "../services/hdWallet.service.js";

// --- Rate limit for read-decrypted (in-memory, TTL). Production: use Redis or DB. ---
const DECRYPT_RATE_WINDOW_MS = 15 * 60 * 1000; // 15 min
const DECRYPT_MAX_ATTEMPTS = 5;
const decryptAttempts = new Map(); // userId -> { count, resetAt }

function checkDecryptRateLimit(userId) {
  const now = Date.now();
  let entry = decryptAttempts.get(userId);
  if (!entry) {
    decryptAttempts.set(userId, { count: 1, resetAt: now + DECRYPT_RATE_WINDOW_MS });
    return true;
  }
  if (now >= entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + DECRYPT_RATE_WINDOW_MS;
    return true;
  }
  entry.count += 1;
  if (entry.count > DECRYPT_MAX_ATTEMPTS) return false;
  return true;
}

/** Get or create default wallet for user (used by custodial generate). */
async function getOrCreateWallet(userId) {
  let wallet = await Wallet.findOne({ userId, isDefault: true });
  if (!wallet) wallet = await Wallet.findOne({ userId }).sort({ createdAt: 1 });
  if (!wallet) {
    wallet = await Wallet.create({ userId, name: "My Wallet", isDefault: true });
    await Promise.all(
      SUPPORTED_ASSETS.map((asset) =>
        Balance.updateOne(
          { walletId: wallet._id, asset },
          { $setOnInsert: { available: 0, locked: 0 } },
          { upsert: true }
        )
      )
    );
  }
  return wallet;
}

/**
 * Get encryption password from environment
 * Falls back to JWT_SECRET if ENCRYPTION_KEY is not set
 */
function getEncryptionKey() {
  return process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "default-key-change-in-production";
}

/**
 * Read user secrets (returns address, but NOT the decrypted private key for security)
 * Use readDecryptedSecrets if you need the private key
 */
export const readSecrets = asyncHandler(async (req, res) => {
  const secret = await UserSecret.findOne({ userId: req.user.id });

  if (!secret) {
    throw ApiError.notFound("No secrets found for this user");
  }

  return ApiResponse.success(
    res,
    {
      id: secret._id,
      userAddress: secret.userAddress,
      network: secret.network,
      label: secret.label,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
      // Note: encryptedPrivateKey is NOT returned for security
    },
    "Secrets retrieved successfully"
  );
});

/**
 * Read decrypted secrets including private key (use with caution - only for internal operations)
 * This endpoint should be used carefully and only when needed for operations
 */
export const readDecryptedSecrets = asyncHandler(async (req, res) => {
  const secret = await UserSecret.findOne({ userId: req.user.id });

  if (!secret) {
    throw ApiError.notFound("No secrets found for this user");
  }

  // Decrypt private key
  const encryptionKey = getEncryptionKey();
  let decryptedPrivateKey;
  try {
    decryptedPrivateKey = decrypt(secret.encryptedPrivateKey, encryptionKey);
  } catch (error) {
    throw ApiError.internalError("Failed to decrypt private key", error.message);
  }

  // Audit log - important to track when private keys are accessed
  await writeAuditLog({
    userId: req.user.id,
    action: "USER_SECRET_DECRYPTED",
    req,
    meta: {
      userAddress: secret.userAddress,
      network: secret.network,
    },
  });

  return ApiResponse.success(
    res,
    {
      id: secret._id,
      userAddress: secret.userAddress,
      privateKey: decryptedPrivateKey,
      network: secret.network,
      label: secret.label,
    },
    "Decrypted secrets retrieved successfully"
  );
});

/**
 * Update user secrets
 */
export const updateSecrets = asyncHandler(async (req, res) => {
  const { userAddress, privateKey, network, label } = req.body;

  const secret = await UserSecret.findOne({ userId: req.user.id });
  if (!secret) {
    throw ApiError.notFound("No secrets found for this user");
  }

  // Build update object
  const updateData = {};
  if (userAddress) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      throw ApiError.validationError("Invalid Ethereum address format");
    }
    updateData.userAddress = userAddress.toLowerCase();
  }
  if (privateKey) {
    const cleanPrivateKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
    if (!/^0x[a-fA-F0-9]{64}$/.test(cleanPrivateKey)) {
      throw ApiError.validationError("Invalid private key format");
    }
    const encryptionKey = getEncryptionKey();
    updateData.encryptedPrivateKey = encrypt(cleanPrivateKey, encryptionKey);
  }
  if (network) {
    updateData.network = network.toUpperCase();
  }
  if (label !== undefined) {
    updateData.label = label || null;
  }

  // Update secret
  Object.assign(secret, updateData);
  await secret.save();

  // Audit log
  await writeAuditLog({
    userId: req.user.id,
    action: "USER_SECRET_UPDATED",
    req,
    meta: {
      updatedFields: Object.keys(updateData),
    },
  });

  return ApiResponse.success(
    res,
    {
      id: secret._id,
      userAddress: secret.userAddress,
      network: secret.network,
      label: secret.label,
      updatedAt: secret.updatedAt,
    },
    "Secrets updated successfully"
  );
});

/**
 * Delete user secrets
 */
export const deleteSecrets = asyncHandler(async (req, res) => {
  const secret = await UserSecret.findOne({ userId: req.user.id });
  if (!secret) {
    throw ApiError.notFound("No secrets found for this user");
  }

  await UserSecret.deleteOne({ userId: req.user.id });

  // Audit log
  await writeAuditLog({
    userId: req.user.id,
    action: "USER_SECRET_DELETED",
    req,
    meta: {
      userAddress: secret.userAddress,
      network: secret.network,
    },
  });

  return ApiResponse.success(res, null, "Secrets deleted successfully");
});

// ========== HD Wallet (mnemonic) API ==========
// One encrypted mnemonic per user; addresses derived at m/44'/60'/0'/0/{index}. Key retrieved via HDNodeWallet.

/**
 * POST /api/secrets/read-decrypted — Return private key for HD-derived address (from mnemonic via HDNodeWallet).
 * Body: { address }. Requires x-confirm: true header. Rate limited.
 */
export const readDecryptedStrict = asyncHandler(async (req, res) => {
  const confirmHeader = req.headers["x-confirm"] === "true" || req.headers["x-confirm"] === true;
  const { address, reason, confirmHeader: confirmBody } = req.body || {};

  if (!address) throw ApiError.validationError("address is required (HD-derived address).");

  const confirmed = confirmHeader || confirmBody === true;
  if (!confirmed) {
    await writeAuditLog({
      userId: req.user.id,
      action: "SECRETS_DECRYPT_DENIED",
      req,
      meta: { reason: "Missing x-confirm: true or confirmHeader in body", address: address || null },
    });
    throw ApiError.forbidden(
      "Decrypt requires explicit confirmation. Send header x-confirm: true or body confirmHeader: true. Rate limit applies."
    );
  }

  if (!checkDecryptRateLimit(req.user.id)) {
    await writeAuditLog({
      userId: req.user.id,
      action: "SECRETS_DECRYPT_RATE_LIMITED",
      req,
      meta: { address: address || null },
    });
    throw ApiError.forbidden("Too many decrypt attempts. Try again later.");
  }

  try {
    const result = await getPrivateKeyForDerivedAddress({ userId: req.user.id, address });
    await writeAuditLog({
      userId: req.user.id,
      action: "SECRETS_DECRYPTED",
      req,
      entityType: "WalletAddress",
      meta: {
        address: result.address,
        reason: reason || "export",
        source: "HDNodeWallet",
        ip: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers["user-agent"],
      },
    });
    return ApiResponse.success(res, { address: result.address, privateKey: result.privateKey });
  } catch (e) {
    if (e.code === "MASTER_KEY_MISSING") {
      throw ApiError.serviceUnavailable(
        "MASTER_KEY must be set in .env for HD key retrieval. Add MASTER_KEY=your-secret-key to backend/.env and restart."
      );
    }
    if (e.message?.includes("not found") || e.message?.includes("not HD-derived")) {
      throw ApiError.notFound(e.message);
    }
    throw ApiError.internalError("HD key retrieval failed", e.message);
  }
});

// ========== HD Wallet (MetaMask-style mnemonic) API ==========
// One encrypted mnemonic per user; addresses derived at m/44'/60'/0'/0/{index}.

/**
 * POST /api/secrets/init-mnemonic — Ensure user has mnemonic (create if missing).
 * Response: { success, hasMnemonic, network, walletId }. Never returns mnemonic.
 */
export const initMnemonic = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const wallet = await getOrCreateWallet(userId);
  const network = String(req.body?.network || "POLYGON_AMOY").toUpperCase();
  if (!SUPPORTED_NETWORKS.includes(network)) {
    throw ApiError.validationError(`Unsupported network: ${network}`);
  }

  const existed = await HDWalletSecret.findOne({ userId });
  let secret;
  try {
    secret = await getOrCreateUserMnemonic({
      userId,
      walletId: wallet._id,
      network,
    });
  } catch (e) {
    if (e.code === "MASTER_KEY_MISSING") {
      throw ApiError.serviceUnavailable(
        "MASTER_KEY must be set in .env (min 16 characters) for HD wallet. Add MASTER_KEY=your-secret-key to backend/.env and restart."
      );
    }
    throw e;
  }

  if (!existed) {
    await writeAuditLog({
      userId,
      walletId: wallet._id,
      action: "MNEMONIC_CREATED",
      req,
      entityType: "HDWalletSecret",
      entityId: secret._id,
      meta: { network: secret.network },
    });
  }

  return ApiResponse.success(res, {
    hasMnemonic: true,
    network: secret.network,
    walletId: wallet._id.toString(),
  }, "Mnemonic ready");
});

/**
 * POST /api/secrets/derive-address — Derive next HD address, store in WalletAddress.
 * Body: { network, asset, label?, setDefault? }.
 */
export const deriveAddress = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { network = "POLYGON_AMOY", asset = "USDT", label, setDefault = false } = req.body || {};
  const net = String(network).toUpperCase();
  const a = String(asset).toUpperCase();
  if (!SUPPORTED_NETWORKS.includes(net)) throw ApiError.validationError(`Unsupported network: ${net}`);
  if (!SUPPORTED_ASSETS.includes(a)) throw ApiError.validationError(`Unsupported asset: ${a}`);

  let result;
  try {
    result = await deriveNewAddressForUser({
      userId,
      asset: a,
      network: net,
      label: label ? String(label).trim() : undefined,
      setDefault: Boolean(setDefault),
    });
  } catch (e) {
    if (e.code === "MASTER_KEY_MISSING") {
      throw ApiError.serviceUnavailable(
        "MASTER_KEY must be set in .env (min 16 characters) for HD wallet. Add MASTER_KEY=your-secret-key to backend/.env and restart."
      );
    }
    if (e.message?.includes("No mnemonic")) {
      throw ApiError.badRequest("No mnemonic for user. Call POST /api/secrets/init-mnemonic first.");
    }
    throw e;
  }

  await writeAuditLog({
    userId,
    walletId: result.walletId,
    action: "ADDRESS_DERIVED",
    req,
    entityType: "WalletAddress",
    meta: {
      address: result.address,
      index: result.index,
      network: result.network,
      asset: result.asset,
      isDefault: result.isDefault,
    },
  });

  return ApiResponse.created(res, {
    address: result.address,
    index: result.index,
    walletId: result.walletId.toString(),
    network: result.network,
    asset: result.asset,
    default: result.isDefault,
    isCustodial: true,
  }, "Address derived");
});

/**
 * GET /api/secrets/addresses?network=&asset= — List stored WalletAddress for user's wallet (HD-derived).
 * Returns address metadata only (no mnemonic, no private key).
 */
export const listAddresses = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const wallet = await getOrCreateWallet(userId);
  const { network, asset } = req.query || {};
  const filter = { walletId: wallet._id };
  if (network) filter.network = String(network).toUpperCase();
  if (asset) filter.asset = String(asset).toUpperCase();

  const list = await WalletAddress.find(filter)
    .select("address derivationIndex asset network label isDefault createdAt")
    .sort({ createdAt: 1 })
    .lean();
  const items = list.map((r) => ({
    address: r.address,
    index: r.derivationIndex ?? null,
    asset: r.asset,
    network: r.network,
    label: r.label ?? null,
    isDefault: r.isDefault,
    createdAt: r.createdAt,
  }));

  await writeAuditLog({
    userId,
    walletId: wallet._id,
    action: "ADDRESSES_LISTED",
    req,
    meta: { count: items.length, network: filter.network || null, asset: filter.asset || null },
  });

  return ApiResponse.success(res, items, "Addresses list");
});
