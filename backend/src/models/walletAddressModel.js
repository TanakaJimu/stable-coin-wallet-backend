import mongoose from "mongoose";

const WalletAddressSchema = new mongoose.Schema(
  {
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", required: true, index: true },
    asset: { type: String, required: true, uppercase: true },
    network: { type: String, required: true, uppercase: true },

    address: { type: String, required: true, trim: true },
    label: { type: String, trim: true, default: null },

    isDefault: { type: Boolean, default: false },
    // Link to custodial Secret (server-generated address + encrypted key)
    secretId: { type: mongoose.Schema.Types.ObjectId, ref: "Secret", default: null },
    isCustodial: { type: Boolean, default: false },
  },
  { timestamps: true }
);

WalletAddressSchema.index({ walletId: 1, asset: 1, network: 1, address: 1 }, { unique: true });
WalletAddressSchema.index({ address: 1 }); // for addressBelongsToUser lookups

export default mongoose.model("WalletAddress", WalletAddressSchema);
