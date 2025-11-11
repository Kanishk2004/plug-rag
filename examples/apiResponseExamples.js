/**
 * API Response Utilities - Usage Examples
 * 
 * This file demonstrates how to use the standardized API response functions
 * in your route handlers for consistent response formatting.
 */

import { 
  apiSuccess, 
  apiError, 
  validationError, 
  authError, 
  forbiddenError, 
  notFoundError, 
  serverError, 
  conflictError,
  createdResponse,
  paginatedResponse,
  withErrorHandling,
  HTTP_STATUS
} from '@/lib/apiResponse.js';

// ========================================
// BASIC USAGE EXAMPLES
// ========================================

/**
 * Example 1: Simple Success Response
 */
function exampleSuccessResponse() {
  // Simple success with data
  return apiSuccess({ id: 1, name: 'John Doe' }, 'User retrieved successfully');
  
  // Success without data
  return apiSuccess(null, 'Operation completed successfully');
  
  // Success with custom status
  return apiSuccess({ id: 1 }, 'User created', 201);
}

/**
 * Example 2: Error Responses
 */
function exampleErrorResponses() {
  // Basic error
  return apiError('Something went wrong');
  
  // Error with custom status and code
  return apiError('Invalid input', 400, 'INVALID_INPUT');
  
  // Validation error with details
  return validationError('Validation failed', {
    email: 'Email is required',
    password: 'Password must be at least 8 characters'
  });
  
  // Authentication error
  return authError('Please log in to access this resource');
  
  // Authorization error
  return forbiddenError('You do not have permission to access this resource');
  
  // Not found error
  return notFoundError('Bot');
  
  // Conflict error (duplicate)
  return conflictError('User already exists', 'email');
}

// ========================================
// ROUTE HANDLER EXAMPLES
// ========================================

/**
 * Example: GET /api/bots - List bots with pagination
 */
export async function GET_BotsExample(request) {
  const { userId } = await auth();
  if (!userId) {
    return authError();
  }

  try {
    await connectDB();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const skip = (page - 1) * limit;
    
    // Fetch bots
    const bots = await Bot.find({ ownerId: userId })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    const total = await Bot.countDocuments({ ownerId: userId });
    
    return paginatedResponse(bots, { page, limit, total });
    
  } catch (error) {
    console.error('Error fetching bots:', error);
    return serverError('Failed to fetch bots');
  }
}

/**
 * Example: POST /api/bots - Create a new bot
 */
export async function POST_BotsExample(request) {
  const { userId } = await auth();
  if (!userId) {
    return authError();
  }

  try {
    const { name, description } = await request.json();
    
    // Validate input
    if (!name?.trim()) {
      return validationError('Bot name is required', { name: 'Name cannot be empty' });
    }
    
    await connectDB();
    
    // Check if bot name already exists
    const existingBot = await Bot.findOne({ ownerId: userId, name });
    if (existingBot) {
      return conflictError('Bot name already exists', 'name');
    }
    
    // Create bot
    const bot = await Bot.create({
      name: name.trim(),
      description: description?.trim() || '',
      ownerId: userId,
    });
    
    return createdResponse(bot, 'Bot created successfully');
    
  } catch (error) {
    console.error('Error creating bot:', error);
    return serverError('Failed to create bot');
  }
}

/**
 * Example: GET /api/bots/[id] - Get specific bot
 */
export async function GET_BotByIdExample(request, { params }) {
  const { userId } = await auth();
  if (!userId) {
    return authError();
  }

  try {
    const { id } = params;
    
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return validationError('Invalid bot ID format');
    }
    
    await connectDB();
    
    const bot = await Bot.findOne({ _id: id, ownerId: userId });
    
    if (!bot) {
      return notFoundError('Bot');
    }
    
    return apiSuccess(bot, 'Bot retrieved successfully');
    
  } catch (error) {
    console.error('Error fetching bot:', error);
    return serverError('Failed to fetch bot');
  }
}

/**
 * Example: DELETE /api/bots/[id] - Delete bot
 */
export async function DELETE_BotExample(request, { params }) {
  const { userId } = await auth();
  if (!userId) {
    return authError();
  }

  try {
    const { id } = params;
    
    await connectDB();
    
    const bot = await Bot.findOneAndDelete({ _id: id, ownerId: userId });
    
    if (!bot) {
      return notFoundError('Bot');
    }
    
    // Could also return noContentResponse() for DELETE operations
    return apiSuccess(null, 'Bot deleted successfully');
    
  } catch (error) {
    console.error('Error deleting bot:', error);
    return serverError('Failed to delete bot');
  }
}

// ========================================
// USING ERROR HANDLING WRAPPER
// ========================================

/**
 * Example: Route with automatic error handling
 */
export const GET_WithErrorHandling = withErrorHandling(async (request) => {
  const { userId } = await auth();
  if (!userId) {
    return authError();
  }
  
  // Any uncaught errors will be automatically handled
  await connectDB();
  const data = await SomeModel.find({ userId });
  
  return apiSuccess(data, 'Data retrieved successfully');
});

// ========================================
// RESPONSE EXAMPLES (JSON OUTPUT)
// ========================================

/**
 * Success Response Example:
 * {
 *   "success": true,
 *   "message": "Bot created successfully",
 *   "data": {
 *     "_id": "507f1f77bcf86cd799439011",
 *     "name": "My Bot",
 *     "description": "A helpful bot",
 *     "ownerId": "user_123"
 *   },
 *   "timestamp": "2025-11-12T10:30:45.123Z"
 * }
 */

/**
 * Error Response Example:
 * {
 *   "success": false,
 *   "error": "Validation failed",
 *   "code": "VALIDATION_ERROR",
 *   "details": {
 *     "email": "Email is required",
 *     "password": "Password must be at least 8 characters"
 *   },
 *   "timestamp": "2025-11-12T10:30:45.123Z"
 * }
 */

/**
 * Paginated Response Example:
 * {
 *   "success": true,
 *   "message": "Bots retrieved successfully",
 *   "data": {
 *     "items": [...],
 *     "pagination": {
 *       "page": 1,
 *       "limit": 10,
 *       "total": 25,
 *       "totalPages": 3,
 *       "hasNextPage": true,
 *       "hasPrevPage": false
 *     }
 *   },
 *   "timestamp": "2025-11-12T10:30:45.123Z"
 * }
 */