import mongoose from "mongoose";
import { TX_TYPES, TX_STATUS } from "../utils/constants.js";

const TransactionSchema = new mongoose.Schema(
  {
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", required: true, index: true },
    type: { type: String, enum: TX_TYPES, required: true },
    status: { type: String, enum: TX_STATUS, default: "COMPLETED" },

    // stablecoin context
    asset: { type: String, uppercase: true },
    network: { type: String, uppercase: true },

    // amounts
    amount: { type: Number, required: true },

    // Send/Receive details
    fromAddress: { type: String, trim: true, default: null },
    toAddress: { type: String, trim: true, default: null },
    memo: { type: String, trim: true, default: null },

    // Swap details
    fromAsset: { type: String, uppercase: true, default: null },
    toAsset: { type: String, uppercase: true, default: null },
    rate: { type: Number, default: null }, // demo / optional
    fee: { type: Number, default: 0 },

    // reference
    reference: { type: String, trim: true, default: null }
  },
  { timestamps: true }
);

TransactionSchema.index({ walletId: 1, createdAt: -1 });

export default mongoose.model("Transaction", TransactionSchema);
