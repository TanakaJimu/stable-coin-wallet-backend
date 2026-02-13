import mongoose from "mongoose";

const NftMintSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenId: { type: Number, required: true },
    txHash: { type: String, trim: true, lowercase: true, required: true },
    contractAddress: { type: String, trim: true, lowercase: true },
    chainId: { type: Number, default: null },
    mintedTo: { type: String, trim: true, lowercase: true },
  },
  { timestamps: true }
);

NftMintSchema.index({ txHash: 1 }, { unique: true });
NftMintSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("NftMint", NftMintSchema);
