// ErrorHandler Class
class ErrorHandler extends Error {
  constructor(statusCode, message) {
    super(message); // Call parent constructor with message
    this.statusCode = statusCode;

    // Maintains proper stack trace in V8 environments
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error Middleware
export const errorMiddleware = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = typeof err.message === "string" ? err.message : "Internal Server Error";

  console.error("ERROR:", err); // Log full error to the console

  // Handle Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message = `Duplicate ${field} entered. Please use a different value.`;
    statusCode = 400;
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    message = "Invalid token. Please log in again.";
    statusCode = 401;
  }

  if (err.name === "TokenExpiredError") {
    message = "Your token has expired. Please log in again.";
    statusCode = 401;
  }

  // Handle invalid MongoDB ObjectId
  if (err.name === "CastError") {
    message = `Invalid ID format: ${err.path}`;
    statusCode = 400;
  }

  // Handle Mongoose Validation Errors
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors || {}).map((val) => val.message);
    message = `Validation Error: ${messages.join(". ")}`;
    statusCode = 400;
  }

  // Send JSON error response
  res.status(statusCode).json({
    success: false,
    message,
  });
};

export default ErrorHandler;
