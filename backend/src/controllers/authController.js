import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import Wallet from "../models/wallet.js";
import Balance from "../models/balance.js";
import { writeAuditLog } from "../middlewares/auditLog.js";
import { SUPPORTED_ASSETS } from "../utils/constants.js";

function signToken(userId) {
  return jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

export async function signup(req, res) {
  try {
    const { firstName, lastName, idNumber, email, phone, password, deviceIdUsedToLogin } = req.body;

    if (!firstName || !lastName || !idNumber || !email || !phone || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const exists = await User.findOne({ $or: [{ email: email.toLowerCase() }, { phone }] });
    if (exists) return res.status(409).json({ message: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      firstName,
      lastName,
      idNumber,
      email: email.toLowerCase(),
      phone,
      passwordHash,
      deviceIdUsedToLogin: deviceIdUsedToLogin || null,
      lastLogin: new Date(),
    });

    // Create wallet
    const wallet = await Wallet.create({ userId: user._id });

    // Create balances for supported stablecoins
    await Balance.insertMany(
      SUPPORTED_ASSETS.map((a) => ({
        walletId: wallet._id,
        asset: a,
        available: 0,
        locked: 0,
      }))
    );

    const token = signToken(user._id.toString());

    await writeAuditLog({
      userId: user._id,
      action: "AUTH_SIGNUP",
      req,
      meta: { email: user.email },
      deviceId: deviceIdUsedToLogin,
    });

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (e) {
    return res.status(500).json({ message: "Signup failed", error: e.message });
  }
}

export async function signin(req, res) {
  try {
    const { email, password, deviceIdUsedToLogin } = req.body;
    if (!email || !password) return res.status(400).json({ message: "email and password required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      await writeAuditLog({ action: "AUTH_SIGNIN_FAIL", status: "FAIL", req, message: "User not found", meta: { email } });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.status !== "ACTIVE") return res.status(403).json({ message: "Account not active" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await writeAuditLog({ userId: user._id, action: "AUTH_SIGNIN_FAIL", status: "FAIL", req, message: "Wrong password" });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    user.lastLogin = new Date();
    user.deviceIdUsedToLogin = deviceIdUsedToLogin || user.deviceIdUsedToLogin;
    await user.save();

    const token = signToken(user._id.toString());

    await writeAuditLog({
      userId: user._id,
      action: "AUTH_SIGNIN_SUCCESS",
      req,
      deviceId: deviceIdUsedToLogin,
    });

    return res.json({
      token,
      user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone },
    });
  } catch (e) {
    return res.status(500).json({ message: "Signin failed", error: e.message });
  }
}

export async function signout(req, res) {
  try {
    await writeAuditLog({
      userId: req.user?.id,
      action: "AUTH_SIGNOUT",
      req,
    });
    return res.json({ ok: true, message: "Signed out (delete token on client)" });
  } catch (e) {
    return res.status(500).json({ message: "Signout failed", error: e.message });
  }
}
