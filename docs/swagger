import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // ===== Identity =====
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    idNumber: {
      type: String,
      required: true,
      unique: true,
      index: true, // fast lookup (KYC)
    },

    // ===== Contact =====
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // ===== Security =====
    password: {
      type: String,
      required: true, // hashed (bcrypt)
      select: false,  // never return by default
    },

    deviceId: {
      type: String,
      required: true, // device used to login
    },

    // ===== 🔑 CRUCIAL ADDITIONS =====

    /** 1️⃣ KYC status (critical for wallets) */
    kycStatus: {
      type: String,
      enum: ["PENDING", "VERIFIED", "REJECTED"],
      default: "PENDING",
      index: true,
    },

    /** 2️⃣ Account role (future-proof: admin, support, etc.) */
    role: {
      type: String,
      enum: ["USER", "ADMIN"],
      default: "USER",
    },

    /** 3️⃣ Account state (block/freeze without deleting) */
    isActive: {
      type: Boolean,
      default: true,
    },

    // ===== Activity =====
    lastLogin: {
      type: Date,
    },

    // Optional but recommended
    refreshTokens: [
      {
        token: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: true,
    },
  }
);

export default mongoose.model("User", userSchema);
