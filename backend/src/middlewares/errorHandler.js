/**
 * Central error handler: use ApiError when available, logger, consistent JSON.
 */
import { ApiError } from "../utils/apiError.js";
import { logger } from "../utils/logger.js";

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof ApiError) {
    logger.warn("ApiError", err.statusCode, err.message);
    return res.status(err.statusCode).json(err.toJSON());
  }

  const status = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  logger.error("ErrorHandler:", err?.message || err);
  if (err?.stack) logger.error(err.stack);

  res.status(status).json({
    success: false,
    message: err.message || "Server error",
    statusCode: status,
    ...(err?.message && { detail: err.message }),
    ...(process.env.NODE_ENV === "development" && err?.stack && { stack: err.stack }),
  });
}
