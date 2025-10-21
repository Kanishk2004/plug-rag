/**
 * Performance monitoring utilities for the RAG chatbot
 */

export class PerformanceMonitor {
  static timers = new Map();

  /**
   * Start timing an operation
   */
  static startTimer(operationName) {
    this.timers.set(operationName, Date.now());
  }

  /**
   * End timing and log the result
   */
  static endTimer(operationName, logLevel = 'info') {
    const startTime = this.timers.get(operationName);
    if (!startTime) {
      console.warn(`Timer for ${operationName} was not started`);
      return null;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(operationName);

    const message = `⏱️ ${operationName}: ${duration}ms`;
    
    if (logLevel === 'warn' && duration > 1000) {
      console.warn(message);
    } else if (logLevel === 'error' && duration > 3000) {
      console.error(message);
    } else {
      console.log(message);
    }

    return duration;
  }

  /**
   * Time an async function
   */
  static async timeAsync(operationName, asyncFn) {
    this.startTimer(operationName);
    try {
      const result = await asyncFn();
      this.endTimer(operationName);
      return result;
    } catch (error) {
      this.endTimer(operationName, 'error');
      throw error;
    }
  }

  /**
   * Log database query performance
   */
  static logQuery(queryName, duration, resultCount = null) {
    const message = resultCount !== null 
      ? `🔍 ${queryName}: ${duration}ms (${resultCount} results)`
      : `🔍 ${queryName}: ${duration}ms`;

    if (duration > 500) {
      console.warn(`⚠️ Slow query - ${message}`);
    } else {
      console.log(message);
    }
  }

  /**
   * Monitor memory usage
   */
  static logMemoryUsage(label = 'Memory Usage') {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      console.log(`📊 ${label}:`, {
        heap: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(usage.external / 1024 / 1024)}MB`,
      });
    }
  }
}

/**
 * Database performance wrapper
 */
export function withPerformanceLogging(model, queryName) {
  return new Proxy(model, {
    get(target, prop) {
      const originalMethod = target[prop];
      
      if (typeof originalMethod === 'function' && 
          ['find', 'findOne', 'findById', 'create', 'updateOne', 'deleteOne'].includes(prop)) {
        
        return async function(...args) {
          const startTime = Date.now();
          try {
            const result = await originalMethod.apply(target, args);
            const duration = Date.now() - startTime;
            
            let resultCount = null;
            if (Array.isArray(result)) {
              resultCount = result.length;
            } else if (result && typeof result === 'object') {
              resultCount = 1;
            }
            
            PerformanceMonitor.logQuery(`${queryName}.${prop}`, duration, resultCount);
            return result;
          } catch (error) {
            const duration = Date.now() - startTime;
            PerformanceMonitor.logQuery(`${queryName}.${prop} (ERROR)`, duration);
            throw error;
          }
        };
      }
      
      return originalMethod;
    }
  });
}

/**
 * API route performance wrapper
 */
export function withAPIPerformanceLogging(handler, routeName) {
  return async function(req, res) {
    const startTime = Date.now();
    const originalJson = res.json;
    
    res.json = function(data) {
      const duration = Date.now() - startTime;
      PerformanceMonitor.logQuery(`API ${routeName}`, duration);
      return originalJson.call(this, data);
    };

    try {
      return await handler(req, res);
    } catch (error) {
      const duration = Date.now() - startTime;
      PerformanceMonitor.logQuery(`API ${routeName} (ERROR)`, duration);
      throw error;
    }
  };
}