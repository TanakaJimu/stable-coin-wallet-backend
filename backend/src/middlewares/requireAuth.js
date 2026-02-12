/**
 * Require JWT: read Authorization: Bearer <token>, validate and attach req.user (id).
 * Use for protected routes. For req.user.email/roles, use the optional withUser() middleware.
 */
import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
    if (!token) return res.status(401).json({ message: "Missing token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.sub };
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid/expired token" });
  }
}
