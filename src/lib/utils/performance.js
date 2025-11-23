/**
 * Performance Monitoring Utilities
 * 
 * Provides tools for measuring and monitoring application performance,
 * including execution time tracking, memory usage, and performance metrics.
 */

import { logPerformance } from './logger.js';

/**
 * Performance metric types
 */
export const METRIC_TYPES = {
  API_CALL: 'api_call',
  DATABASE_QUERY: 'database_query', 
  FILE_PROCESSING: 'file_processing',
  EMBEDDING_GENERATION: 'embedding_generation',
  VECTOR_SEARCH: 'vector_search',
  MEMORY_USAGE: 'memory_usage'
};

/**
 * Simple performance timer class
 */
class PerformanceTimer {
  constructor(name) {
    this.name = name;
    this.startTime = Date.now();
    this.markers = [];
  }

  /**
   * Add a performance marker
   * @param {string} label - Marker label
   */
  mark(label) {
    const now = Date.now();
    this.markers.push({
      label,
      time: now - this.startTime,
      timestamp: now
    });
  }

  /**
   * End the timer and log results
   * @param {Object} meta - Additional metadata
   * @returns {number} Total duration in ms
   */
  end(meta = {}) {
    const duration = Date.now() - this.startTime;
    
    logPerformance(this.name, duration, {
      markers: this.markers,
      ...meta
    });

    return duration;
  }
}

/**
 * Create a new performance timer
 * @param {string} name - Timer name
 * @returns {PerformanceTimer} Timer instance
 */
export function createPerformanceTimer(name) {
  return new PerformanceTimer(name);
}

/**
 * Measure execution time of a function
 * @param {Function} fn - Function to measure
 * @param {string} name - Operation name for logging
 * @returns {Function} Wrapped function with timing
 */
export function measureTime(fn, name) {
  if (typeof fn !== 'function') {
    throw new Error('First argument must be a function');
  }

  return async function(...args) {
    const timer = createPerformanceTimer(name);
    
    try {
      const result = await fn.apply(this, args);
      timer.end({ success: true });
      return result;
    } catch (error) {
      timer.end({ success: false, error: error.message });
      throw error;
    }
  };
}

/**
 * Get current memory usage
 * @returns {Object} Memory usage statistics
 */
export function getMemoryUsage() {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024) // MB
    };
  }
  return null;
}

/**
 * Log memory usage with optional label
 * @param {string} label - Label for the memory measurement
 */
export function logMemoryUsage(label = 'Memory Usage') {
  const usage = getMemoryUsage();
  if (usage) {
    logPerformance(label, 0, { 
      type: METRIC_TYPES.MEMORY_USAGE,
      memory: usage 
    });
  }
}

/**
 * Performance decorator for async functions
 * @param {string} metricType - Type of metric being measured
 * @returns {Function} Decorator function
 */
export function performanceMonitor(metricType) {
  return function(target, propertyName, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args) {
      const timer = createPerformanceTimer(`${target.constructor.name}.${propertyName}`);
      
      try {
        const result = await originalMethod.apply(this, args);
        timer.end({ 
          type: metricType,
          success: true 
        });
        return result;
      } catch (error) {
        timer.end({ 
          type: metricType,
          success: false,
          error: error.message 
        });
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Monitor API endpoint performance
 * @param {string} endpoint - API endpoint name
 * @param {Function} handler - Request handler function
 * @returns {Function} Wrapped handler with performance monitoring
 */
export function monitorApiEndpoint(endpoint, handler) {
  return measureTime(handler, `API: ${endpoint}`);
}

/**
 * Monitor database query performance
 * @param {string} operation - Database operation name
 * @param {Function} queryFn - Query function
 * @returns {Function} Wrapped query function
 */
export function monitorDatabaseQuery(operation, queryFn) {
  return measureTime(queryFn, `DB: ${operation}`);
}

/**
 * Monitor file processing performance
 * @param {string} operation - File operation name
 * @param {Function} processFn - Processing function
 * @returns {Function} Wrapped processing function
 */
export function monitorFileProcessing(operation, processFn) {
  return measureTime(processFn, `File: ${operation}`);
}

/**
 * Monitor embedding operations
 * @param {string} operation - Embedding operation name
 * @param {Function} embeddingFn - Embedding function
 * @returns {Function} Wrapped embedding function
 */
export function monitorEmbedding(operation, embeddingFn) {
  return measureTime(embeddingFn, `Embedding: ${operation}`);
}

/**
 * Simple rate limiter for performance-sensitive operations
 * @param {Function} fn - Function to rate limit
 * @param {number} maxCalls - Maximum calls per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Function} Rate-limited function
 */
export function rateLimit(fn, maxCalls = 10, windowMs = 60000) {
  const calls = [];

  return function(...args) {
    const now = Date.now();
    
    // Remove calls outside the window
    while (calls.length > 0 && calls[0] < now - windowMs) {
      calls.shift();
    }

    if (calls.length >= maxCalls) {
      throw new Error(`Rate limit exceeded: ${maxCalls} calls per ${windowMs}ms`);
    }

    calls.push(now);
    return fn.apply(this, args);
  };
}

/**
 * Batch processing utility for performance optimization
 * @param {Function} processFn - Function to process each item
 * @param {number} batchSize - Number of items to process at once
 * @param {number} delayMs - Delay between batches in ms
 * @returns {Function} Batch processing function
 */
export function batchProcess(processFn, batchSize = 10, delayMs = 100) {
  return async function(items) {
    const results = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const timer = createPerformanceTimer(`Batch ${i / batchSize + 1}`);
      
      try {
        const batchResults = await Promise.all(
          batch.map(item => processFn(item))
        );
        results.push(...batchResults);
        timer.end({ batchSize: batch.length });
        
        // Add delay between batches to prevent overwhelming the system
        if (i + batchSize < items.length && delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        timer.end({ batchSize: batch.length, error: error.message });
        throw error;
      }
    }
    
    return results;
  };
}
