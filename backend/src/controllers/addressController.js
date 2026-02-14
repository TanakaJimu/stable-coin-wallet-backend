import { HDNodeWallet, isAddress } from "ethers";
import Address from "../models/address.model.js";
import MnemonicStore from "../models/mnemonicStore.model.js";
import { SUPPORTED_NETWORKS } from "../utils/constants.js";
import { encryptText, decryptText } from "../utils/crypto.js";
import { writeAuditLog } from "../middlewares/auditLog.js";

const DEFAULT_NETWORK = "POLYGON_AMOY";
const DERIVATION_PATH_PREFIX = "m/44'/60'/0'/0";

/**
 * Derive EVM address from mnemonic at index (MetaMask-style path m/44'/60'/0'/0/index).
 */
function deriveFromMnemonic(mnemonic, index = 0) {
  const root = HDNodeWallet.fromPhrase(mnemonic.trim());
  const path = `${DERIVATION_PATH_PREFIX}/${index}`;
  const child = root.derivePath(path);
  return { address: child.address.toLowerCase(), privateKey: child.privateKey };
}

/**
 * POST /api/address/import-mnemonic
 * Body: { mnemonic: "word1 word2 ..." } (12 or 24 words). Encrypts and stores; one per user.
 * Must be called before deriving addresses.
 */
export async function importMnemonic(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { mnemonic } = req.body || {};
    if (!mnemonic || typeof mnemonic !== "string") {
      return res.status(400).json({ success: false, message: "mnemonic is required (12 or 24 words)" });
    }

    const trimmed = mnemonic.trim();
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount !== 12 && wordCount !== 24) {
      return res.status(400).json({ success: false, message: "Mnemonic must be 12 or 24 words" });
    }

    try {
      HDNodeWallet.fromPhrase(trimmed);
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: "Invalid mnemonic phrase",
        detail: e.message,
      });
    }

    let encrypted;
    try {
      encrypted = encryptText(trimmed);
    } catch (e) {
      return res.status(503).json({
        success: false,
        message: "Encryption not available. Set WALLET_ENC_KEY in .env (32+ characters).",
        detail: e.message,
      });
    }

    await MnemonicStore.findOneAndUpdate(
      { userId },
      { userId, encryptedMnemonic: encrypted },
      { upsert: true, new: true }
    );

    try {
      await writeAuditLog({
        userId,
        action: "MNEMONIC_IMPORTED",
        req,
        entityType: "MnemonicStore",
        meta: { wordCount },
      });
    } catch (_) {}

    return res.status(201).json({
      success: true,
      message: "Mnemonic stored securely. You can now derive addresses.",
    });
  } catch (e) {
    console.error("importMnemonic error:", e);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred",
      ...(process.env.NODE_ENV === "development" && { detail: e.message }),
    });
  }
}

/**
 * POST /api/address/derive (and POST /api/address/generate as alias)
 * Body: { network?, label?, index?, storePrivateKey? }
 * Derives address from stored mnemonic at given index (MetaMask-style). Requires import-mnemonic first.
 * Never returns private key. Optionally stores encrypted derived key in Address.
 */
export async function deriveAddress(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { network = DEFAULT_NETWORK, label = "Main", index, storePrivateKey = false } = req.body || {};
    const net = String(network).toUpperCase();
    if (!SUPPORTED_NETWORKS.includes(net)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported network",
        supported: SUPPORTED_NETWORKS,
      });
    }

    const store = await MnemonicStore.findOne({ userId });
    if (!store) {
      return res.status(400).json({
        success: false,
        message: "No mnemonic on file. Call POST /api/address/import-mnemonic first with your 12 or 24 word phrase.",
      });
    }

    let mnemonic;
    try {
      mnemonic = decryptText(store.encryptedMnemonic);
    } catch (e) {
      return res.status(503).json({
        success: false,
        message: "Could not decrypt mnemonic. Check WALLET_ENC_KEY.",
        detail: e.message,
      });
    }

    let derivationIndex;
    if (index !== undefined && index !== null) {
      const n = Number(index);
      if (!Number.isInteger(n) || n < 0) {
        return res.status(400).json({ success: false, message: "index must be a non-negative integer" });
      }
      derivationIndex = n;
    } else {
      const maxDoc = await Address.findOne({ userId, network: net }).sort({ derivationIndex: -1 }).select("derivationIndex").lean();
      derivationIndex = maxDoc ? (maxDoc.derivationIndex ?? 0) + 1 : 0;
    }

    const { address, privateKey } = deriveFromMnemonic(mnemonic, derivationIndex);
    if (!isAddress(address)) {
      return res.status(500).json({ success: false, message: "Invalid address derived" });
    }

    const existing = await Address.findOne({ userId, network: net, address });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "This address already exists for this user and network",
      });
    }

    const count = await Address.countDocuments({ userId, network: net });
    const isDefault = count === 0;

    let encryptedPrivateKey = null;
    if (storePrivateKey) {
      try {
        encryptedPrivateKey = encryptText(privateKey);
      } catch (_) {}
    }

    const doc = await Address.create({
      userId,
      network: net,
      address,
      derivationIndex,
      label: String(label || "Main").trim() || "Main",
      isDefault,
      encryptedPrivateKey,
      meta: {},
    });

    if (req.body?.isDefault === true) {
      await Address.updateMany(
        { userId, network: net, _id: { $ne: doc._id } },
        { $set: { isDefault: false } }
      );
      doc.isDefault = true;
      await doc.save();
    }

    try {
      await writeAuditLog({
        userId,
        action: "ADDRESS_DERIVED",
        req,
        entityType: "Address",
        entityId: doc._id,
        meta: { address: doc.address, network: net, derivationIndex },
      });
    } catch (_) {}

    return res.status(201).json({
      id: doc._id.toString(),
      address: doc.address,
      network: doc.network,
      derivationIndex: doc.derivationIndex,
      label: doc.label,
      isDefault: doc.isDefault,
      createdAt: doc.createdAt,
    });
  } catch (e) {
    console.error("deriveAddress error:", e);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred",
      ...(process.env.NODE_ENV === "development" && { detail: e.message }),
    });
  }
}

/** Alias for deriveAddress so existing clients using POST /generate still work. */
export async function generateAddress(req, res) {
  return deriveAddress(req, res);
}

/**
 * GET /api/address
 * Query: network (optional). Returns list of derived addresses; excludes encryptedPrivateKey.
 */
export async function listAddresses(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { network } = req.query || {};
    const filter = { userId };
    if (network) {
      const net = String(network).toUpperCase();
      if (!SUPPORTED_NETWORKS.includes(net)) {
        return res.status(400).json({
          success: false,
          message: "Unsupported network",
          supported: SUPPORTED_NETWORKS,
        });
      }
      filter.network = net;
    }

    const list = await Address.find(filter)
      .select("-encryptedPrivateKey")
      .sort({ derivationIndex: 1, createdAt: 1 })
      .lean();

    const items = list.map((d) => ({
      _id: d._id.toString(),
      address: d.address,
      network: d.network,
      derivationIndex: d.derivationIndex,
      label: d.label,
      isDefault: d.isDefault,
      createdAt: d.createdAt,
    }));

    return res.json({ items });
  } catch (e) {
    console.error("listAddresses error:", e);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred",
      ...(process.env.NODE_ENV === "development" && { detail: e.message }),
    });
  }
}

/**
 * GET /api/address/default?network=POLYGON_AMOY
 * Returns default address for user and network.
 */
export async function getDefaultAddress(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const network = (req.query?.network || DEFAULT_NETWORK).toString().toUpperCase();
    if (!SUPPORTED_NETWORKS.includes(network)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported network",
        supported: SUPPORTED_NETWORKS,
      });
    }

    const doc = await Address.findOne({ userId, network, isDefault: true })
      .select("address network label derivationIndex")
      .lean();
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "No default address found for this network. Derive an address first.",
        network,
      });
    }

    return res.json({
      address: doc.address,
      network: doc.network,
      label: doc.label,
      derivationIndex: doc.derivationIndex,
    });
  } catch (e) {
    console.error("getDefaultAddress error:", e);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred",
      ...(process.env.NODE_ENV === "development" && { detail: e.message }),
    });
  }
}

/**
 * PATCH /api/address/:id/default
 * Set address :id as default for its network; unset others for same user/network.
 */
export async function setDefault(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const doc = await Address.findOne({ _id: req.params.id, userId });
    if (!doc) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    await Address.updateMany(
      { userId, network: doc.network },
      { $set: { isDefault: false } }
    );
    doc.isDefault = true;
    await doc.save();

    try {
      await writeAuditLog({
        userId,
        action: "ADDRESS_SET_DEFAULT",
        req,
        entityType: "Address",
        entityId: doc._id,
        meta: { address: doc.address, network: doc.network },
      });
    } catch (_) {}

    return res.json({
      id: doc._id.toString(),
      address: doc.address,
      network: doc.network,
      label: doc.label,
      isDefault: true,
    });
  } catch (e) {
    console.error("setDefault error:", e);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred",
      ...(process.env.NODE_ENV === "development" && { detail: e.message }),
    });
  }
}

/**
 * DELETE /api/address/:id
 * Delete address (owner only). If it was default, set earliest by derivationIndex as default.
 */
export async function deleteAddress(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const doc = await Address.findOne({ _id: req.params.id, userId });
    if (!doc) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    const wasDefault = doc.isDefault;
    const network = doc.network;
    await Address.deleteOne({ _id: doc._id });

    if (wasDefault) {
      const next = await Address.findOne({ userId, network }).sort({ derivationIndex: 1, createdAt: 1 });
      if (next) {
        next.isDefault = true;
        await next.save();
      }
    }

    try {
      await writeAuditLog({
        userId,
        action: "ADDRESS_DELETED",
        req,
        entityType: "Address",
        entityId: doc._id,
        meta: { address: doc.address, network },
      });
    } catch (_) {}

    return res.json({ success: true, message: "Address deleted" });
  } catch (e) {
    console.error("deleteAddress error:", e);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred",
      ...(process.env.NODE_ENV === "development" && { detail: e.message }),
    });
  }
}
