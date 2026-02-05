import mongoose from "mongoose";

const WalletSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },

    // Display preferences
    defaultFiat: { type: String, default: "USD" },

    // simple status flags
    isLocked: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model("Wallet", WalletSchema);
