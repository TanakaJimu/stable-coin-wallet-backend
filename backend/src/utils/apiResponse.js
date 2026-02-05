/**
 * Standardized API Response Utility
 * Follows SOLID principles - Single Responsibility: Response formatting
 */
export class ApiResponse {
  /**
   * Success response
   * @param {Object} res - Express response object
   * @param {*} data - Response data
   * @param {string} message - Success message
   * @param {number} statusCode - HTTP status code (default: 200)
   */
  static success(res, data = null, message = "Success", statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Created response (201)
   * @param {Object} res - Express response object
   * @param {*} data - Response data
   * @param {string} message - Success message
   */
  static created(res, data = null, message = "Resource created successfully") {
    return this.success(res, data, message, 201);
  }

  /**
   * No content response (204)
   * @param {Object} res - Express response object
   */
  static noContent(res) {
    return res.status(204).send();
  }

  /**
   * Paginated response
   * @param {Object} res - Express response object
   * @param {Array} items - Array of items
   * @param {number} page - Current page
   * @param {number} limit - Items per page
   * @param {number} total - Total items
   * @param {string} message - Success message
   */
  static paginated(res, items, page, limit, total, message = "Success") {
    return res.status(200).json({
      success: true,
      message,
      data: {
        items,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: Number(total),
          pages: Math.ceil(total / limit),
        },
      },
      timestamp: new Date().toISOString(),
    });
  }
}

