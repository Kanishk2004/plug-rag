/**
 * Simple logging utility
 * Provides consistent logging interface across the application
 */

/**
 * Log info message
 */
export function logInfo(message, data = null) {
  if (data) {
    console.info(`[INFO] ${message}`, data);
  } else {
    console.info(`[INFO] ${message}`);
  }
}

/**
 * Log error message
 */
export function logError(message, data = null) {
  if (data) {
    console.error(`[ERROR] ${message}`, data);
  } else {
    console.error(`[ERROR] ${message}`);
  }
}

/**
 * Log warning message
 */
export function logWarn(message, data = null) {
  if (data) {
    console.warn(`[WARN] ${message}`, data);
  } else {
    console.warn(`[WARN] ${message}`);
  }
}

/**
 * Log performance metrics
 */
export function logPerformance(metric, duration, data = null) {
  const message = `[PERF] ${metric}: ${duration}ms`;
  if (data) {
    console.info(message, data);
  } else {
    console.info(message);
  }
}