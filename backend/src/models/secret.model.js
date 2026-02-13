import mongoose from "mongoose";

/**
 * Custodial Secret Model
 * Stores server-generated Ethereum-style addresses and encrypted private keys.
 * Private keys are NEVER stored in plaintext; only encrypted payload (cipherText, salt, iv, tag).
 *
 * SECURITY: This is custodial — the server holds users' private keys.
 * Production: use KMS (AWS KMS / GCP KMS / HashiCorp Vault) for MASTER_KEY; consider HSM for signing.
 */
const SecretSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", index: true },
    address: { type: String, required: true, trim: true, lowercase: true, index: true },
    network: { type: String, default: "POLYGON_AMOY", uppercase: true },
    asset: { type: String, uppercase: true, default: null },
    label: { type: String, trim: true, default: null },
    isDefault: { type: Boolean, default: false },
    isCustodial: { type: Boolean, default: true },
    // Encrypted private key payload (AES-256-GCM). Never store plaintext.
    encrypted: {
      cipherText: { type: String, default: null },
      salt: { type: String, default: null },
      iv: { type: String, default: null },
      tag: { type: String, default: null },
    },
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

SecretSchema.index({ userId: 1, createdAt: -1 });
SecretSchema.index({ address: 1 });

export default mongoose.model("Secret", SecretSchema);
