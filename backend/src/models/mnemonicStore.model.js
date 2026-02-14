import mongoose from "mongoose";

/**
 * Encrypted BIP-39 mnemonic per user. Used to derive addresses (MetaMask-style HD path m/44'/60'/0'/0/n).
 * One stored mnemonic per user; addresses are derived from it, not randomly generated.
 */
const mnemonicStoreSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    encryptedMnemonic: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("MnemonicStore", mnemonicStoreSchema);
