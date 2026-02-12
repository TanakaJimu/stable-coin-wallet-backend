import mongoose from "mongoose";

const WalletSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // Optional label for multiple wallets
    name: { type: String, default: "My Wallet", trim: true },

    // One wallet per user can be the default (used when no walletId is specified)
    isDefault: { type: Boolean, default: false },

    // Display preferences
    defaultFiat: { type: String, default: "USD" },

    // simple status flags
    isLocked: { type: Boolean, default: false }
  },
  { timestamps: true }
);

WalletSchema.index({ userId: 1, isDefault: 1 });

export default mongoose.model("Wallet", WalletSchema);
