/**
 * Standardized API Response Utilities
 * 
 * This module provides consistent response formatting for all API endpoints.
 * Use these functions to ensure uniform response structure across the application.
 */

import { NextResponse } from 'next/server';

/**
 * Standard API response structure:
 * {
 *   success: boolean,
 *   message: string,
 *   data?: any,
 *   error?: string,
 *   code?: string,
 *   timestamp: string
 * }
 */

/**
 * Create a successful API response
 * 
 * @param {any} data - Response data (optional)
 * @param {string} message - Success message (optional)
 * @param {number} status - HTTP status code (default: 200)
 * @returns {NextResponse} Formatted success response
 */
export function apiSuccess(data = null, message = 'Success', status = 200) {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString(),
  };

  // Only include data if it's provided
  if (data !== null && data !== undefined) {
    response.data = data;
  }

  return NextResponse.json(response, { status });
}

/**
 * Create an error API response
 * 
 * @param {string} message - Error message
 * @param {number} status - HTTP status code (default: 400)
 * @param {string} code - Error code for easier debugging (optional)
 * @param {any} details - Additional error details (optional)
 * @returns {NextResponse} Formatted error response
 */
export function apiError(message = 'An error occurred', status = 400, code = null, details = null) {
  const response = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  };

  // Add error code if provided
  if (code) {
    response.code = code;
  }

  // Add details if provided (useful for validation errors)
  if (details) {
    response.details = details;
  }

  return NextResponse.json(response, { status });
}

/**
 * Validation error response (400)
 * 
 * @param {string} message - Validation error message
 * @param {Object|Array} validationDetails - Specific validation errors
 * @returns {NextResponse} Formatted validation error response
 */
export function validationError(message = 'Validation failed', validationDetails = null) {
  return apiError(message, 400, 'VALIDATION_ERROR', validationDetails);
}

/**
 * Authentication error response (401)
 * 
 * @param {string} message - Authentication error message
 * @returns {NextResponse} Formatted authentication error response
 */
export function authError(message = 'Authentication required') {
  return apiError(message, 401, 'AUTH_ERROR');
}

/**
 * Authorization error response (403)
 * 
 * @param {string} message - Authorization error message
 * @returns {NextResponse} Formatted authorization error response
 */
export function forbiddenError(message = 'Access denied') {
  return apiError(message, 403, 'FORBIDDEN_ERROR');
}

/**
 * Not found error response (404)
 * 
 * @param {string} resource - Resource that wasn't found
 * @returns {NextResponse} Formatted not found error response
 */
export function notFoundError(resource = 'Resource') {
  return apiError(`${resource} not found`, 404, 'NOT_FOUND_ERROR');
}

/**
 * Internal server error response (500)
 * 
 * @param {string} message - Error message
 * @param {string} errorId - Unique error ID for tracking (optional)
 * @returns {NextResponse} Formatted server error response
 */
export function serverError(message = 'Internal server error', errorId = null) {
  const response = apiError(message, 500, 'SERVER_ERROR');
  
  if (errorId) {
    response.errorId = errorId;
  }
  
  return response;
}

/**
 * Rate limit error response (429)
 * 
 * @param {string} message - Rate limit message
 * @param {number} retryAfter - Seconds until retry is allowed (optional)
 * @returns {NextResponse} Formatted rate limit error response
 */
export function rateLimitError(message = 'Rate limit exceeded', retryAfter = null) {
  const response = apiError(message, 429, 'RATE_LIMIT_ERROR');
  
  const headers = {};
  if (retryAfter) {
    headers['Retry-After'] = retryAfter.toString();
    response.body.retryAfter = retryAfter;
  }
  
  return NextResponse.json(response.body, { 
    status: 429, 
    headers 
  });
}

/**
 * Conflict error response (409) - for duplicate resources
 * 
 * @param {string} message - Conflict error message
 * @param {string} conflictField - Field that caused the conflict (optional)
 * @returns {NextResponse} Formatted conflict error response
 */
export function conflictError(message = 'Resource already exists', conflictField = null) {
  const details = conflictField ? { conflictField } : null;
  return apiError(message, 409, 'CONFLICT_ERROR', details);
}

/**
 * Created response (201) - for successful resource creation
 * 
 * @param {any} data - Created resource data
 * @param {string} message - Success message
 * @returns {NextResponse} Formatted created response
 */
export function createdResponse(data, message = 'Resource created successfully') {
  return apiSuccess(data, message, 201);
}

/**
 * No content response (204) - for successful operations with no response body
 * 
 * @returns {NextResponse} Empty response with 204 status
 */
export function noContentResponse() {
  return new NextResponse(null, { status: 204 });
}

/**
 * Paginated response helper
 * 
 * @param {Array} items - Array of items for current page
 * @param {Object} pagination - Pagination metadata
 * @param {number} pagination.page - Current page number
 * @param {number} pagination.limit - Items per page
 * @param {number} pagination.total - Total number of items
 * @param {string} message - Success message
 * @returns {NextResponse} Formatted paginated response
 */
export function paginatedResponse(items, pagination, message = 'Data retrieved successfully') {
  const { page, limit, total } = pagination;
  const totalPages = Math.ceil(total / limit);
  
  const data = {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
  
  return apiSuccess(data, message);
}

/**
 * Helper to catch and format async route errors
 * Use this to wrap your route handlers for consistent error handling
 * 
 * @param {Function} routeHandler - Async route handler function
 * @returns {Function} Wrapped route handler with error catching
 */
export function withErrorHandling(routeHandler) {
  return async (...args) => {
    try {
      return await routeHandler(...args);
    } catch (error) {
      console.error('API Route Error:', error);
      
      // Generate unique error ID for tracking
      const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Log error with ID for debugging
      console.error(`[${errorId}] ${error.message}`, {
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
      
      return serverError('Something went wrong. Please try again.', errorId);
    }
  };
}

/**
 * Common HTTP status codes for reference
 */
export const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  
  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  
  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  SERVICE_UNAVAILABLE: 503,
};