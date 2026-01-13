import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.js";

const router = express.Router();

// Helpers
const signAccessToken = (user) => {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
  );
};

const signRefreshToken = (user) => {
  return jwt.sign(
    { sub: user._id.toString(), type: "refresh" },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d" }
  );
};

/**
 * POST /api/auth/signup
 * body: { firstName,lastName,idNumber,email,phone,password,deviceId }
 */
router.post("/signup", async (req, res) => {
  try {
    const { firstName, lastName, idNumber, email, phone, password, deviceId } =
      req.body;

    // Basic validation
    if (!firstName || !lastName || !idNumber || !email || !phone || !password || !deviceId) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Unique checks
    const exists = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }, { idNumber }],
    });

    if (exists) {
      return res.status(409).json({ message: "User already exists (email/phone/idNumber)." });
    }

    const hashed = await bcrypt.hash(password, 12);

    const user = await User.create({
      firstName,
      lastName,
      idNumber,
      email: email.toLowerCase(),
      phone,
      password: hashed,
      deviceId,
      lastLogin: new Date(),
    });

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    // Store refresh token (simple approach)
    await User.updateOne(
      { _id: user._id },
      { $push: { refreshTokens: { token: refreshToken } } }
    );

    return res.status(201).json({
      message: "Signup successful",
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        kycStatus: user.kycStatus,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/auth/signin
 * body: { emailOrPhone, password, deviceId }
 */
router.post("/signin", async (req, res) => {
  try {
    const { emailOrPhone, password, deviceId } = req.body;

    if (!emailOrPhone || !password || !deviceId) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Find by email or phone (and include password)
    const user = await User.findOne({
      $or: [{ email: emailOrPhone.toLowerCase() }, { phone: emailOrPhone }],
    }).select("+password");

    if (!user) return res.status(401).json({ message: "Invalid credentials." });
    if (!user.isActive) return res.status(403).json({ message: "Account is disabled." });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials." });

    // Optional: device binding (block if device mismatch)
    // If you want to ALLOW device change, you can update deviceId here instead.
    if (user.deviceId !== deviceId) {
      return res.status(403).json({ message: "Unrecognized device." });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    user.lastLogin = new Date();
    user.refreshTokens.push({ token: refreshToken });
    await user.save();

    return res.json({
      message: "Signin successful",
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        kycStatus: user.kycStatus,
        role: user.role,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
      },
    });
  } catch (err) {
    console.error("Signin error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/auth/signout
 * body: { refreshToken }
 * Removes refresh token from DB so it can't be used again.
 */
router.post("/signout", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: "refreshToken required" });
    }

    // Verify refresh token signature (optional but recommended)
    try {
      jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
      );
    } catch {
      // even if invalid, you can still attempt to remove it
    }

    await User.updateOne(
      { "refreshTokens.token": refreshToken },
      { $pull: { refreshTokens: { token: refreshToken } } }
    );

    return res.json({ message: "Signed out" });
  } catch (err) {
    console.error("Signout error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
