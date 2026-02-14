import mongoose from "mongoose";

const WalletAddressSchema = new mongoose.Schema(
  {
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    asset: { type: String, required: true, uppercase: true },
    network: { type: String, required: true, uppercase: true },

    address: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, trim: true, default: null },
    derivationIndex: { type: Number, default: null },

    isDefault: { type: Boolean, default: false },
    isCustodial: { type: Boolean, default: false },
    secretId: { type: mongoose.Schema.Types.ObjectId, ref: "Secret", default: null },
    hdSecretId: { type: mongoose.Schema.Types.ObjectId, ref: "HDWalletSecret", default: null },
  },
  { timestamps: true }
);

WalletAddressSchema.index({ walletId: 1, asset: 1, network: 1, address: 1 }, { unique: true });
WalletAddressSchema.index({ address: 1 }); // for addressBelongsToUser lookups

export default mongoose.model("WalletAddress", WalletAddressSchema);
