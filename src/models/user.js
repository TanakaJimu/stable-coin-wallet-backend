import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    firstName: { type: String, trim: true, required: true },
    lastName: { type: String, trim: true, required: true },

    idNumber: { type: String, trim: true, required: true },

    email: { type: String, trim: true, lowercase: true, required: true, unique: true, index: true },
    phone: { type: String, trim: true, required: true, unique: true, index: true },

    passwordHash: { type: String, required: true },

    deviceIdUsedToLogin: { type: String, trim: true, default: null },
    lastLogin: { type: Date, default: null },

    // + 3 crucial extras
    isEmailVerified: { type: Boolean, default: false },
    status: { type: String, enum: ["ACTIVE", "SUSPENDED"], default: "ACTIVE" },
    pinHash: { type: String, default: null }
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
