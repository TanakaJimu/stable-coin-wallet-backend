import AuditLog from "../models/auditLog.js";

export async function writeAuditLog({
  userId,
  walletId,
  action,
  status = "SUCCESS",
  message,
  entityType,
  entityId,
  req,
  meta = {},
  deviceId,
} = {}) {
  try {
    const ip =
      req?.headers?.["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
      req?.socket?.remoteAddress ||
      req?.ip;

    const userAgent = req?.headers?.["user-agent"];

    await AuditLog.create({
      userId,
      walletId,
      action,
      status,
      message,
      entityType,
      entityId,
      ip,
      userAgent,
      deviceId: deviceId || req?.headers?.["x-device-id"],
      meta,
    });
  } catch (e) {
    console.warn("AuditLog write failed:", e?.message);
  }
}
