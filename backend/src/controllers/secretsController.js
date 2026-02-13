import UserSecret from "../models/userSecret.js";
import Secret from "../models/secret.model.js";
import Wallet from "../models/wallet.js";
import WalletAddress from "../models/walletAddressModel.js";
import Balance from "../models/balance.js";
import { SUPPORTED_ASSETS } from "../utils/constants.js";
import { writeAuditLog } from "../middlewares/auditLog.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError, asyncHandler } from "../utils/apiError.js";
import { encrypt, decrypt } from "../utils/encryption.js";
import { encryptPrivateKey, decryptPrivateKey } from "../services/crypto.service.js";
import { createRandomWallet } from "../services/walletGen.service.js";

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
 * Create secrets by generating a new custodial address (server creates address + encrypted key).
 * Accepts only: network, asset, label, setDefault. walletId is assigned by the backend (default wallet).
 */
export const createSecrets = asyncHandler(async (req, res) => {
  if (req.body && (req.body.userAddress != null || req.body.privateKey != null)) {
    throw ApiError.validationError(
      "Do not send userAddress or privateKey. Send only network, asset, label, setDefault."
    );
  }
  if (req.body && req.body.walletId != null) {
    throw ApiError.validationError(
      "Do not send walletId; it is assigned by the backend. Send only network, asset, label, setDefault."
    );
  }
  return generateCustodialAddress(req, res);
});

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

// ========== Custodial (server-generated) address API ==========
// SECURITY: Custodial mode — server holds private keys. Use KMS for MASTER_KEY in production.
// Prefer non-custodial flows; limit read-decrypted usage; log all decrypt events.

/**
 * POST /api/secrets/generate — Generate new custodial address (ethers Wallet.createRandom).
 * Encrypts private key with MASTER_KEY; creates Secret + WalletAddress; optional setDefault.
 */
export const generateCustodialAddress = asyncHandler(async (req, res) => {
  const { network = "POLYGON_AMOY", asset, label, setDefault = false } = req.body || {};
  const userId = req.user.id;

  // Require MASTER_KEY for encryption; fail fast with clear message instead of 500
  const masterKey = process.env.MASTER_KEY;
  if (!masterKey || String(masterKey).length < 16) {
    throw ApiError.serviceUnavailable(
      "MASTER_KEY must be set in .env (min 16 characters) for custodial address generation. Add MASTER_KEY=your-secret-key to backend/.env and restart."
    );
  }

  // Wallet is always determined by backend (default wallet or create one). User does not send walletId.
  const wallet = await getOrCreateWallet(userId);

  const net = String(network || "POLYGON_AMOY").toUpperCase();
  const { address, privateKey } = createRandomWallet();
  // Encrypt immediately; never persist plaintext.
  const encrypted = encryptPrivateKey(privateKey);

  const secret = await Secret.create({
    userId,
    walletId: wallet._id,
    address: address.toLowerCase(),
    network: net,
    asset: asset ? String(asset).toUpperCase() : null,
    label: label ? String(label).trim() : null,
    isDefault: Boolean(setDefault),
    isCustodial: true,
    encrypted,
  });

  if (setDefault) {
    await Secret.updateMany(
      { userId, _id: { $ne: secret._id } },
      { $set: { isDefault: false } }
    );
  }

  // WalletAddress: link to this secret for receive-address / deposit flows. Use first supported asset if none.
  const assetForAddress = asset ? String(asset).toUpperCase() : "USDT";
  const depositReference = `w_${wallet._id.toString()}_${address.slice(2, 10)}`;
  await WalletAddress.findOneAndUpdate(
    { walletId: wallet._id, asset: assetForAddress, network: net },
    {
      $set: {
        address: address.toLowerCase(),
        label: label || depositReference,
        isDefault: Boolean(setDefault),
        secretId: secret._id,
        isCustodial: true,
      },
    },
    { upsert: true }
  );

  await writeAuditLog({
    userId,
    walletId: wallet._id,
    action: "SECRETS_GENERATED",
    req,
    entityType: "Secret",
    entityId: secret._id,
    meta: { address: address.toLowerCase(), network: net, isCustodial: true },
  });

  const assetVal = asset ? String(asset).toUpperCase() : null;
  return res.status(201).json({
    success: true,
    secretId: secret._id.toString(),
    address: address,
    walletId: wallet._id.toString(),
    network: net,
    asset: assetVal,
    default: Boolean(setDefault),
    isCustodial: true,
  });
});

/**
 * GET /api/secrets — List custodial secrets for user (address only; no private key).
 */
export const listCustodialSecrets = asyncHandler(async (req, res) => {
  const secrets = await Secret.find({
    userId: req.user.id,
    deletedAt: null,
    "encrypted.cipherText": { $ne: null },
  })
    .select("_id address network walletId label isDefault isCustodial createdAt")
    .sort({ createdAt: -1 })
    .lean();
  const list = secrets.map((s) => ({
    secretId: s._id.toString(),
    address: s.address,
    network: s.network,
    walletId: s.walletId?.toString(),
    label: s.label,
    isDefault: s.isDefault,
  }));
  return ApiResponse.success(res, list, "Custodial secrets list");
});

/**
 * GET /api/secrets/:id — Single secret metadata (no private key). Ownership required.
 */
export const getSecretById = asyncHandler(async (req, res) => {
  const secret = await Secret.findOne({
    _id: req.params.id,
    userId: req.user.id,
    deletedAt: null,
  }).select("_id address network walletId asset label isDefault isCustodial createdAt lastUsedAt");
  if (!secret) throw ApiError.notFound("Secret not found");
  return ApiResponse.success(res, {
    secretId: secret._id.toString(),
    address: secret.address,
    network: secret.network,
    walletId: secret.walletId?.toString(),
    asset: secret.asset,
    label: secret.label,
    isDefault: secret.isDefault,
    isCustodial: secret.isCustodial,
    createdAt: secret.createdAt,
    lastUsedAt: secret.lastUsedAt,
  });
});

/**
 * POST /api/secrets/read-decrypted — Return private key ONLY under strict conditions.
 * Requires: x-confirm: true header (or optional password in body — see caveat in comments).
 * Rate limited per user. Heavily audited. Use only when user explicitly needs to export key (e.g. import to MetaMask).
 * CAVEAT: Storing/validating user password for this endpoint is sensitive; prefer x-confirm for dev; in production use 2FA or step-up auth.
 */
export const readDecryptedStrict = asyncHandler(async (req, res) => {
  const confirmHeader = req.headers["x-confirm"] === "true" || req.headers["x-confirm"] === true;
  const { secretId, reason, password, confirmHeader: confirmBody } = req.body || {};

  if (!secretId) throw ApiError.validationError("secretId is required");

  const secret = await Secret.findOne({
    _id: secretId,
    userId: req.user.id,
    deletedAt: null,
    "encrypted.cipherText": { $ne: null },
  });
  if (!secret) throw ApiError.notFound("Secret not found");

  // Strict: require explicit confirmation (header or body flag). Optionally require password in production.
  const confirmed = confirmHeader || confirmBody === true;
  if (!confirmed) {
    await writeAuditLog({
      userId: req.user.id,
      action: "SECRETS_DECRYPT_DENIED",
      req,
      entityType: "Secret",
      entityId: secret._id,
      meta: { reason: "Missing x-confirm: true or confirmHeader in body", secretId },
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
      meta: { secretId },
    });
    throw ApiError.forbidden("Too many decrypt attempts. Try again later.");
  }

  let privateKey;
  try {
    privateKey = decryptPrivateKey(secret.encrypted);
  } catch (e) {
    throw ApiError.internalError("Decryption failed", e.message);
  }

  await Secret.updateOne({ _id: secret._id }, { $set: { lastUsedAt: new Date() } });

  await writeAuditLog({
    userId: req.user.id,
    walletId: secret.walletId,
    action: "SECRETS_DECRYPTED",
    req,
    entityType: "Secret",
    entityId: secret._id,
    meta: {
      address: secret.address,
      reason: reason || "export",
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
    },
  });

  return ApiResponse.success(res, {
    address: secret.address,
    privateKey,
  });
});

/**
 * DELETE /api/secrets/:id — Soft-delete custodial secret (zero out encrypted data, set deletedAt).
 */
export const deleteSecretById = asyncHandler(async (req, res) => {
  const secret = await Secret.findOne({
    _id: req.params.id,
    userId: req.user.id,
  });
  if (!secret) throw ApiError.notFound("Secret not found");

  const prevAddress = secret.address;
  secret.encrypted = { cipherText: null, salt: null, iv: null, tag: null };
  secret.address = `deleted_${secret._id}`;
  secret.isCustodial = false;
  secret.deletedAt = new Date();
  await secret.save();

  await WalletAddress.updateMany(
    { secretId: secret._id },
    { $unset: { secretId: 1 }, $set: { isCustodial: false } }
  );

  await writeAuditLog({
    userId: req.user.id,
    walletId: secret.walletId,
    action: "SECRETS_DELETED",
    req,
    entityType: "Secret",
    entityId: secret._id,
    meta: { previousAddressObfuscated: prevAddress ? `${prevAddress.slice(0, 10)}...` : "n/a" },
  });

  return ApiResponse.success(res, null, "Secret deleted");
});

