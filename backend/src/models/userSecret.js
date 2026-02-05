import mongoose from "mongoose";

/**
 * UserSecret Model
 * Stores encrypted user addresses and private keys for convenience
 * Private keys are encrypted using AES-256-GCM
 */
const UserSecretSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
      index: true,
    },
    // User's wallet address (stored in plain text as it's public)
    userAddress: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v) {
          // Basic Ethereum address validation
          return /^0x[a-fA-F0-9]{40}$/.test(v);
        },
        message: "Invalid Ethereum address format",
      },
    },
    // Encrypted private key (encrypted using encryption utility)
    encryptedPrivateKey: {
      type: String,
      required: true,
    },
    // Network this secret is associated with
    network: {
      type: String,
      default: "polygon",
      uppercase: true,
    },
    // Optional label/name for this secret
    label: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

// Index for faster lookups
UserSecretSchema.index({ userId: 1, network: 1 });

export default mongoose.model("UserSecret", UserSecretSchema);

