import mongoose from "mongoose";

/**
 * One encrypted mnemonic per user (custodial HD wallet).
 * Addresses are derived at m/44'/60'/0'/0/{index}; nextIndex is incremented on each derive.
 * encryptedMnemonic uses same format as crypto.service (cipherText, salt, iv, tag).
 */
const hdWalletSecretSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", required: true, index: true },
    network: { type: String, default: "POLYGON_AMOY", uppercase: true },
    encryptedMnemonic: {
      cipherText: { type: String, required: true },
      salt: { type: String, required: true },
      iv: { type: String, required: true },
      tag: { type: String, required: true },
    },
    nextIndex: { type: Number, default: 0 },
  },
  { timestamps: true }
);

hdWalletSecretSchema.index({ userId: 1 }, { unique: true });

export default mongoose.model("HDWalletSecret", hdWalletSecretSchema);
