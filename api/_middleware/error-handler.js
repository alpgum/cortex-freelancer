const IS_PROD = process.env.NODE_ENV === 'production' || process.env.VERCEL;

/**
 * Custom API error class. Throw this inside handlers for controlled error responses.
 */
class ApiError extends Error {
  constructor(statusCode, message, code, type = 'api_error') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.type = type;
  }
}

/**
 * Send a standardized error response.
 * Format: { success: false, error: { message, code, type } }
 */
function sendError(res, statusCode, message, code, type = 'api_error') {
  res.status(statusCode).json({
    success: false,
    error: { message, code, type }
  });
}

/**
 * Wrap a Vercel serverless handler with standardized error handling.
 * Catches unhandled errors and ApiError instances, returns consistent format.
 * Never exposes stack traces in production.
 */
function withErrorHandler(handler) {
  return async function wrappedHandler(req, res) {
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof ApiError) {
        return sendError(res, err.statusCode, err.message, err.code, err.type);
      }

      console.error(`[${req.url}] Unhandled error:`, IS_PROD ? err.message : err);

      sendError(
        res,
        500,
        IS_PROD ? 'Internal server error. Please try again or contact support.' : err.message,
        'INTERNAL_ERROR',
        'server_error'
      );
    }
  };
}

/**
 * Express error-handling middleware (4-arg signature).
 * Mount after all routes: app.use(expressErrorHandler)
 */
function expressErrorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return sendError(res, err.statusCode, err.message, err.code, err.type);
  }

  console.error(`[${req.url}] Unhandled error:`, IS_PROD ? err.message : err);

  sendError(
    res,
    500,
    IS_PROD ? 'Internal server error. Please try again or contact support.' : err.message,
    'INTERNAL_ERROR',
    'server_error'
  );
}

module.exports = { ApiError, sendError, withErrorHandler, expressErrorHandler };
