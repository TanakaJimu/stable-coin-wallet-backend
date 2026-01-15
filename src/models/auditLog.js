import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    // Who performed the action
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    // What happened
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
      // examples:
      // AUTH_SIGNIN
      // AUTH_SIGNOUT
      // WALLET_SEND
      // WALLET_SWAP
      // WALLET_TOPUP
      // BENEFICIARY_ADDED
    },

    // Context / metadata
    message: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    // Request info (security/compliance)
    ip: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    deviceId: {
      type: String,
      trim: true,
    },

    // Optional entity reference
    entityType: {
      type: String,
      trim: true,
      // e.g. "transaction", "wallet", "beneficiary"
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // Success / failure
    status: {
      type: String,
      enum: ["SUCCESS", "FAIL"],
      default: "SUCCESS",
      index: true,
    },

    // Extra structured info (never store secrets)
    meta: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true, // createdAt / updatedAt
  }
);

// Helpful indexes for admin queries
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
