import UserSecret from "../models/userSecret.js";
import Wallet from "../models/wallet.js";
import { writeAuditLog } from "../middlewares/auditLog.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError, asyncHandler } from "../utils/apiError.js";
import { encrypt, decrypt } from "../utils/encryption.js";

/**
 * Get encryption password from environment
 * Falls back to JWT_SECRET if ENCRYPTION_KEY is not set
 */
function getEncryptionKey() {
  return process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "default-key-change-in-production";
}

/**
 * Create user secrets (address and private key)
 */
export const createSecrets = asyncHandler(async (req, res) => {
  const { userAddress, privateKey, network = "polygon", label } = req.body;

  // Validation
  if (!userAddress) {
    throw ApiError.validationError("userAddress is required");
  }
  if (!privateKey) {
    throw ApiError.validationError("privateKey is required");
  }

  // Validate Ethereum address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
    throw ApiError.validationError("Invalid Ethereum address format");
  }

  // Validate private key format (should start with 0x and be 66 chars, or 64 chars without 0x)
  const cleanPrivateKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(cleanPrivateKey)) {
    throw ApiError.validationError("Invalid private key format");
  }

  // Ensure user has wallet
  const wallet = await Wallet.findOne({ userId: req.user.id });
  if (!wallet) {
    throw ApiError.notFound("Wallet not found. Please create a wallet first.");
  }

  // Encrypt private key
  const encryptionKey = getEncryptionKey();
  const encryptedPrivateKey = encrypt(cleanPrivateKey, encryptionKey);

  // Store or update secret
  const secret = await UserSecret.findOneAndUpdate(
    { userId: req.user.id },
    {
      userId: req.user.id,
      walletId: wallet._id,
      userAddress: userAddress.toLowerCase(),
      encryptedPrivateKey,
      network: network.toUpperCase(),
      label: label || null,
    },
    { upsert: true, new: true, runValidators: true }
  );

  // Audit log
  await writeAuditLog({
    userId: req.user.id,
    action: "USER_SECRET_STORED",
    req,
    meta: {
      userAddress,
      network: network.toUpperCase(),
      hasPrivateKey: true,
    },
  });

    return ApiResponse.success(
    res,
    {
      id: secret._id,
      userAddress: secret.userAddress,
      network: secret.network,
      label: secret.label,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
    },
    "Secrets created successfully"
  );
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

