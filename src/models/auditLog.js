import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },

    action: { type: String, required: true, trim: true, index: true },

    entityType: { type: String, trim: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },

    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true },
    deviceId: { type: String, trim: true },

    status: { type: String, enum: ["SUCCESS", "FAIL"], default: "SUCCESS" },
    message: { type: String, trim: true, maxlength: 160 },

    meta: { type: Object, default: {} }
  },
  { timestamps: true }
);

AuditLogSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("AuditLog", AuditLogSchema);
