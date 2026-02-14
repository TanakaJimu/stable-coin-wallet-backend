/**
 * HD wallet (MetaMask-style) mnemonic + derivation.
 * Uses MASTER_KEY only (not JWT_SECRET). Path: m/44'/60'/0'/0/{index}
 */
import { Wallet, HDNodeWallet } from "ethers";
import HDWalletSecret from "../models/hdWalletSecret.model.js";
import WalletAddress from "../models/walletAddressModel.js";
import WalletModel from "../models/wallet.js";
import { SUPPORTED_ASSETS, SUPPORTED_NETWORKS } from "../utils/constants.js";
import { encryptPrivateKey, decryptPrivateKey } from "./crypto.service.js";

const DEFAULT_NETWORK = "POLYGON_AMOY";

function ensureMasterKey() {
  const key = process.env.MASTER_KEY;
  if (!key || String(key).length < 16) {
    const err = new Error("MASTER_KEY must be set in .env (min 16 characters). Use KMS in production.");
    err.code = "MASTER_KEY_MISSING";
    throw err;
  }
}

/**
 * Get or create HD wallet secret for user. If none exists, generates mnemonic (Wallet.createRandom().mnemonic.phrase), encrypts with MASTER_KEY, stores.
 * @param {{ userId: string|ObjectId, walletId: ObjectId, network?: string }}
 * @returns {Promise<{ _id, userId, walletId, network, nextIndex }>}
 */
export async function getOrCreateUserMnemonic({ userId, walletId, network = DEFAULT_NETWORK }) {
  const net = String(network).toUpperCase();
  let secret = await HDWalletSecret.findOne({ userId });
  if (secret) return secret;

  ensureMasterKey();
  const wallet = Wallet.createRandom();
  const phrase = wallet.mnemonic?.phrase;
  if (!phrase) throw new Error("Wallet.createRandom() did not return mnemonic");
  const encryptedMnemonic = encryptPrivateKey(phrase);

  secret = await HDWalletSecret.create({
    userId,
    walletId,
    network: net,
    encryptedMnemonic,
    nextIndex: 0,
  });
  return secret;
}

/**
 * Derive address from mnemonic at index (path m/44'/60'/0'/0/{index}).
 * In ethers v6, fromPhrase() without path returns a node at default path (depth 5), so we pass "m" to get the root, then derive.
 * @param {string} mnemonic
 * @param {number} index
 * @returns {{ address: string, privateKey: string }}
 */
export function deriveAddressFromMnemonic(mnemonic, index) {
  const root = HDNodeWallet.fromPhrase(mnemonic.trim(), "", "m");
  const path = `m/44'/60'/0'/0/${index}`;
  const child = root.derivePath(path);
  return {
    address: child.address,
    privateKey: child.privateKey,
  };
}

/**
 * Derive new address for user at nextIndex, store in WalletAddress, increment nextIndex atomically.
 * @param {{ userId: string|ObjectId, asset: string, network?: string, label?: string, setDefault?: boolean }}
 * @returns {Promise<{ address: string, index: number, walletId: ObjectId, network: string, asset: string, isDefault: boolean }>}
 */
export async function deriveNewAddressForUser({ userId, asset, network = DEFAULT_NETWORK, label, setDefault = false }) {
  const net = String(network).toUpperCase();
  const a = String(asset || "USDT").toUpperCase();
  if (!SUPPORTED_NETWORKS.includes(net)) throw new Error(`Unsupported network: ${net}`);
  if (!SUPPORTED_ASSETS.includes(a)) throw new Error(`Unsupported asset: ${a}`);

  let secret = await HDWalletSecret.findOne({ userId });
  if (!secret) throw new Error("No mnemonic for user. Call init-mnemonic first.");
  ensureMasterKey();

  const mnemonic = decryptPrivateKey(secret.encryptedMnemonic);
  const currentIndex = secret.nextIndex;
  const { address, privateKey } = deriveAddressFromMnemonic(mnemonic, currentIndex);
  const addressLower = address.toLowerCase();

  const updated = await HDWalletSecret.findOneAndUpdate(
    { userId },
    { $inc: { nextIndex: 1 } },
    { new: true }
  );
  if (!updated) throw new Error("Failed to increment nextIndex");

  const walletId = secret.walletId;
  const existingCount = await WalletAddress.countDocuments({ walletId, asset: a, network: net });
  const isDefault = setDefault || existingCount === 0;

  if (isDefault) {
    await WalletAddress.updateMany(
      { walletId, asset: a, network: net },
      { $set: { isDefault: false } }
    );
  }

  await WalletAddress.create({
    walletId,
    userId: secret.userId,
    asset: a,
    network: net,
    address: addressLower,
    label: label ? String(label).trim() || null : null,
    derivationIndex: currentIndex,
    isCustodial: true,
    isDefault,
    hdSecretId: secret._id,
  });

  return {
    address: addressLower,
    index: currentIndex,
    walletId,
    network: net,
    asset: a,
    isDefault,
  };
}

/**
 * Retrieve private key for an HD-derived address by deriving from mnemonic (HDNodeWallet).
 * Use this when the address was created via derive-address (WalletAddress.hdSecretId set).
 * @param {{ userId: string|ObjectId, address: string }}
 * @returns {Promise<{ address: string, privateKey: string, derivationIndex: number }>}
 */
export async function getPrivateKeyForDerivedAddress({ userId, address }) {
  if (!address || typeof address !== "string") throw new Error("address is required");
  const addressLower = address.trim().toLowerCase();

  const userWalletIds = (await WalletModel.find({ userId }).select("_id").lean()).map((w) => w._id);
  const wa = await WalletAddress.findOne({
    address: addressLower,
    walletId: { $in: userWalletIds },
    hdSecretId: { $ne: null },
  }).lean();
  if (!wa) throw new Error("Address not found for this user or not HD-derived");
  const derivationIndex = wa.derivationIndex;
  if (derivationIndex == null) throw new Error("Missing derivation index for HD address");

  const secret = await HDWalletSecret.findOne({ _id: wa.hdSecretId, userId }).lean();
  if (!secret) throw new Error("HD wallet secret not found");

  ensureMasterKey();
  const mnemonic = decryptPrivateKey(secret.encryptedMnemonic);
  const { address: derivedAddress, privateKey } = deriveAddressFromMnemonic(mnemonic, derivationIndex);
  if (derivedAddress.toLowerCase() !== addressLower) throw new Error("Address mismatch after derivation");
  return { address: derivedAddress.toLowerCase(), privateKey, derivationIndex };
}
