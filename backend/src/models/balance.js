import mongoose from "mongoose";

const BalanceSchema = new mongoose.Schema(
  {
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", required: true, index: true },
    asset: { type: String, required: true, uppercase: true },
    available: { type: Number, default: 0 },
    locked: { type: Number, default: 0 }
  },
  { timestamps: true }
);

BalanceSchema.index({ walletId: 1, asset: 1 }, { unique: true });

export default mongoose.model("Balance", BalanceSchema);
