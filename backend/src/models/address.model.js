import mongoose from "mongoose";

/**
 * User EVM address derived from mnemonic (MetaMask-style HD path m/44'/60'/0'/0/derivationIndex).
 * Stored after derivation; optionally keeps encryptedPrivateKey for the derived key.
 * Compound unique: one (userId, network, address) per document.
 */
const addressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    network: { type: String, required: true, uppercase: true, index: true },
    address: { type: String, required: true, trim: true, lowercase: true },
    derivationIndex: { type: Number, default: 0 },
    label: { type: String, default: "Main", trim: true },
    isDefault: { type: Boolean, default: false },
    encryptedPrivateKey: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

addressSchema.index({ userId: 1, network: 1, address: 1 }, { unique: true });
addressSchema.index({ userId: 1, network: 1, isDefault: 1 });

export default mongoose.model("Address", addressSchema);
