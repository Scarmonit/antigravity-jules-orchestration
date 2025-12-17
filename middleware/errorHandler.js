/**
 * Comprehensive Error Handling Middleware for Jules MCP Server
 * Version: 1.5.0
 * Handles all API errors with proper logging, status codes, and client responses
 */

class AppError extends Error {
  constructor(message, statusCode, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error types for different scenarios
class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 400, details);
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

class ExternalServiceError extends AppError {
  constructor(service, originalError) {
    super(`${service} service unavailable`, 502, {
      service,
      originalMessage: originalError?.message
    });
    this.name = 'ExternalServiceError';
  }
}

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Main error handling middleware
const errorHandler = (err, req, res, _next) => {
  const timestamp = new Date().toISOString();
  const requestId = req.headers['x-request-id'] || generateRequestId();

  // Default to 500 server error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  const details = err.details || {};

  // Log error with context
  const errorLog = {
    timestamp,
    requestId,
    method: req.method,
    path: req.path,
    statusCode,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    details,
    userAgent: req.headers['user-agent']
  };

  if (statusCode >= 500) {
    console.error('[ERROR]', JSON.stringify(errorLog, null, 2));
  } else {
    console.warn('[WARN]', JSON.stringify(errorLog, null, 2));
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired';
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    message = 'Service temporarily unavailable';
  } else if (err.code === 'ETIMEDOUT') {
    statusCode = 504;
    message = 'Request timeout';
  }

  // Send error response
  const response = {
    success: false,
    error: {
      message,
      statusCode,
      requestId,
      timestamp
    }
  };

  // Include details in development mode
  if (process.env.NODE_ENV === 'development') {
    response.error.details = details;
    response.error.stack = err.stack;
  }

  // Add helpful hints for common errors
  if (statusCode === 401) {
    response.error.hint = 'Please check your authentication credentials';
  } else if (statusCode === 404) {
    response.error.hint = 'The requested resource does not exist';
  } else if (statusCode === 429) {
    response.error.hint = 'Please try again later';
    response.error.retryAfter = 60;
  }

  res.status(statusCode).json(response);
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.path}`));
};

// Request ID generator
const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Request ID middleware
const requestIdMiddleware = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || generateRequestId();
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

export {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ExternalServiceError,
  asyncHandler,
  errorHandler,
  notFoundHandler,
  requestIdMiddleware
};
