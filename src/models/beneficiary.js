import mongoose from "mongoose";

const BeneficiarySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    nickname: { type: String, trim: true, required: true, maxlength: 40 },
    address: { type: String, trim: true, required: true, maxlength: 120 },

    asset: { type: String, trim: true, required: true, uppercase: true },
    network: { type: String, trim: true, required: true, uppercase: true },

    isWhitelisted: { type: Boolean, default: false },
    note: { type: String, trim: true, maxlength: 120 },

    lastUsedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

BeneficiarySchema.index({ userId: 1, address: 1, asset: 1, network: 1 }, { unique: true });

export default mongoose.model("Beneficiary", BeneficiarySchema);
