/**
 * Custom API Error Class
 * Follows SOLID principles - Single Responsibility: Error handling
 */
export class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Error message
   * @param {boolean} isOperational - Whether error is operational (expected) or programming error
   * @param {*} details - Additional error details
   */
  constructor(statusCode, message, isOperational = true, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON response format
   * @returns {Object} Error response object
   */
  toJSON() {
    return {
      success: false,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      ...(this.details && { details: this.details }),
    };
  }

  /**
   * Send error response
   * @param {Object} res - Express response object
   */
  send(res) {
    return res.status(this.statusCode).json(this.toJSON());
  }

  // Static factory methods for common errors
  static badRequest(message = "Bad Request", details = null) {
    return new ApiError(400, message, true, details);
  }

  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message, true);
  }

  static forbidden(message = "Forbidden") {
    return new ApiError(403, message, true);
  }

  static notFound(message = "Resource not found") {
    return new ApiError(404, message, true);
  }

  static conflict(message = "Resource conflict") {
    return new ApiError(409, message, true);
  }

  static validationError(message = "Validation failed", details = null) {
    return new ApiError(422, message, true, details);
  }

  static internalError(message = "Internal server error", details = null) {
    return new ApiError(500, message, false, details);
  }

  static serviceUnavailable(message = "Service unavailable") {
    return new ApiError(503, message, true);
  }
}

/**
 * Async error handler wrapper
 * Follows SOLID principles - Single Responsibility: Error boundary
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function with error handling
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      if (error instanceof ApiError) {
        return error.send(res);
      }

      // Log unexpected errors
      console.error("Unexpected error:", error);

      // Send generic error response
      const apiError = ApiError.internalError(
        "An unexpected error occurred",
        process.env.NODE_ENV === "development" ? error.message : undefined
      );
      return apiError.send(res);
    });
  };
};

