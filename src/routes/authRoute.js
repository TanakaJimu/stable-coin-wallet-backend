import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import AuditLog from "../models/auditLog.js";

const router = express.Router();

// Helpers
const signAccessToken = (user) => {
  return jwt.sign(
    { sub: user._id.toString() },
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
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - idNumber
 *               - email
 *               - phone
 *               - password
 *               - deviceId
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               idNumber:
 *                 type: string
 *                 example: "1234567890"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "SecurePassword123!"
 *               deviceId:
 *                 type: string
 *                 example: "device-uuid-1234"
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
      passwordHash: hashed,
      deviceIdUsedToLogin: deviceId,
      lastLogin: new Date(),
      status: "ACTIVE",
    });

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

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
        status: user.status,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * @swagger
 * /api/auth/signin:
 *   post:
 *     summary: Sign in with email/phone and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emailOrPhone
 *               - password
 *               - deviceId
 *             properties:
 *               emailOrPhone:
 *                 type: string
 *                 description: Email address or phone number
 *                 example: john.doe@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "SecurePassword123!"
 *               deviceId:
 *                 type: string
 *                 example: "device-uuid-1234"
 *     responses:
 *       200:
 *         description: Sign in successful
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/AuthResponse'
 *                 - type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         lastLogin:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Account disabled or unrecognized device
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/signin", async (req, res) => {
  try {
    const { emailOrPhone, password, deviceId } = req.body;

    if (!emailOrPhone || !password || !deviceId) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Find by email or phone (and include passwordHash)
    const user = await User.findOne({
      $or: [{ email: emailOrPhone.toLowerCase() }, { phone: emailOrPhone }],
    }).select("+passwordHash");

    if (!user) return res.status(401).json({ message: "Invalid credentials." });
    if (user.status !== "ACTIVE") return res.status(403).json({ message: "Account is disabled." });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials." });

    // Optional: device binding (block if device mismatch)
    // If you want to ALLOW device change, you can update deviceIdUsedToLogin here instead.
    if (user.deviceIdUsedToLogin && user.deviceIdUsedToLogin !== deviceId) {
      return res.status(403).json({ message: "Unrecognized device." });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    user.lastLogin = new Date();
    user.deviceIdUsedToLogin = deviceId;
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
        status: user.status,
        isEmailVerified: user.isEmailVerified,
        lastLogin: user.lastLogin,
      },
    });
  } catch (err) {
    console.error("Signin error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * @swagger
 * /api/auth/signout:
 *   post:
 *     summary: Sign out user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Signed out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Signed out successfully
 *       401:
 *         description: Authorization token required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/signout", async (req, res) => {
  try {
    // 1) Get access token from Authorization header
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!token) {
      return res.status(401).json({ message: "Authorization token required" });
    }

    // 2) Verify token
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // Token may be expired – still allow logout
      payload = null;
    }

    // 3) Log signout if user can be identified
    if (payload?.sub) {
      await AuditLog.create({
        userId: payload.sub,
        action: "AUTH_SIGNOUT",
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
    }

    // 4) Respond success (logout is idempotent)
    return res.json({
      message: "Signed out successfully",
    });
  } catch (err) {
    console.error("Signout error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
