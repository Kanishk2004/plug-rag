/**
 * Structured Logging Utilities
 * 
 * Provides consistent logging across the application with different log levels
 * and structured output for better debugging and monitoring.
 */

/**
 * Log levels for different types of messages
 */
export const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN', 
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

/**
 * Create a structured log entry
 * @param {string} level - Log level (ERROR, WARN, INFO, DEBUG)
 * @param {string} message - Log message
 * @param {Object} meta - Additional metadata
 * @returns {Object} Structured log object
 */
function createLogEntry(level, message, meta = {}) {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  };
}

/**
 * Log an error message
 * @param {string} message - Error message
 * @param {Object} meta - Additional error context
 */
export function logError(message, meta = {}) {
  const logEntry = createLogEntry(LOG_LEVELS.ERROR, message, meta);
  console.error('[ERROR]', JSON.stringify(logEntry, null, 2));
}

/**
 * Log a warning message
 * @param {string} message - Warning message
 * @param {Object} meta - Additional warning context
 */
export function logWarn(message, meta = {}) {
  const logEntry = createLogEntry(LOG_LEVELS.WARN, message, meta);
  console.warn('[WARN]', JSON.stringify(logEntry, null, 2));
}

/**
 * Log an info message
 * @param {string} message - Info message
 * @param {Object} meta - Additional info context
 */
export function logInfo(message, meta = {}) {
  const logEntry = createLogEntry(LOG_LEVELS.INFO, message, meta);
  console.info('[INFO]', JSON.stringify(logEntry, null, 2));
}

/**
 * Log a debug message (only in development)
 * @param {string} message - Debug message
 * @param {Object} meta - Additional debug context
 */
export function logDebug(message, meta = {}) {
  if (process.env.NODE_ENV === 'development') {
    const logEntry = createLogEntry(LOG_LEVELS.DEBUG, message, meta);
    console.debug('[DEBUG]', JSON.stringify(logEntry, null, 2));
  }
}

/**
 * Log API request/response for debugging
 * @param {Object} requestData - Request information
 * @param {Object} responseData - Response information
 * @param {number} duration - Request duration in ms
 */
export function logApiCall(requestData, responseData, duration) {
  logInfo('API Call', {
    request: {
      method: requestData.method,
      url: requestData.url,
      userAgent: requestData.userAgent
    },
    response: {
      status: responseData.status,
      success: responseData.success
    },
    duration: `${duration}ms`
  });
}

/**
 * Log file processing events
 * @param {string} operation - Processing operation (upload, process, delete, etc.)
 * @param {string} fileId - File identifier
 * @param {Object} details - Operation details
 */
export function logFileOperation(operation, fileId, details = {}) {
  logInfo(`File ${operation}`, {
    operation,
    fileId,
    ...details
  });
}

/**
 * Log bot operations
 * @param {string} operation - Bot operation (create, update, delete, etc.)
 * @param {string} botId - Bot identifier
 * @param {Object} details - Operation details
 */
export function logBotOperation(operation, botId, details = {}) {
  logInfo(`Bot ${operation}`, {
    operation,
    botId,
    ...details
  });
}

/**
 * Log embedding operations
 * @param {string} operation - Embedding operation (generate, store, search, etc.)
 * @param {Object} details - Operation details
 */
export function logEmbeddingOperation(operation, details = {}) {
  logInfo(`Embedding ${operation}`, {
    operation,
    ...details
  });
}

/**
 * Log performance metrics
 * @param {string} operation - Operation being measured
 * @param {number} duration - Duration in milliseconds
 * @param {Object} meta - Additional performance context
 */
export function logPerformance(operation, duration, meta = {}) {
  logInfo('Performance Metric', {
    operation,
    duration: `${duration}ms`,
    ...meta
  });
}

/**
 * Create a performance timer
 * @param {string} operation - Operation name
 * @returns {Function} Timer function to call when operation completes
 */
export function createTimer(operation) {
  const startTime = Date.now();
  
  return (meta = {}) => {
    const duration = Date.now() - startTime;
    logPerformance(operation, duration, meta);
    return duration;
  };
}
