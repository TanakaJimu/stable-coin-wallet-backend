import mongoose from "mongoose";
import { TX_TYPES, TX_STATUS } from "../utils/constants.js";

const TransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", required: true, index: true },
    type: { type: String, enum: TX_TYPES, required: true },
    status: { type: String, enum: TX_STATUS, default: "COMPLETED" },

    asset: { type: String, uppercase: true },
    network: { type: String, uppercase: true },
    amount: { type: Number, required: true },

    fromAddress: { type: String, trim: true, default: null },
    toAddress: { type: String, trim: true, default: null },
    memo: { type: String, trim: true, default: null },
    reference: { type: String, trim: true, default: null },

    fromAsset: { type: String, uppercase: true, default: null },
    toAsset: { type: String, uppercase: true, default: null },
    rate: { type: Number, default: null },
    fee: { type: Number, default: 0 },

    txHash: { type: String, trim: true, lowercase: true, default: null },
    confirmations: { type: Number, default: null },
    chainId: { type: Number, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

TransactionSchema.index({ walletId: 1, createdAt: -1 });
TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ txHash: 1 }, { unique: true, sparse: true });

export default mongoose.model("Transaction", TransactionSchema);
