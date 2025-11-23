import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiKeyService } from '@/lib/core/apiKeyService.js';
import { validateOpenAIKey } from '@/lib/integrations/openai.js';
import connect from '@/lib/integrations/mongo';
import {
  apiSuccess,
  authError,
  validationError,
  notFoundError,
  serverError
} from '@/lib/utils/apiResponse';

/**
 * API Key Management Endpoints
 * Handles CRUD operations for custom OpenAI API keys per bot
 */

/**
 * GET /api/bots/[id]/api-keys - Get API key configuration status
 */
export async function GET(request, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return authError();
    }

    const { id: botId } = await params;
    await connect();

    const status = await apiKeyService.getKeyStatus(botId, userId);

    return apiSuccess(status, 'API key configuration retrieved successfully');

  } catch (error) {
    console.error('Get API key status error:', error);
    return serverError('Failed to get API key status');
  }
}

/**
 * POST /api/bots/[id]/api-keys - Set/update API key
 */
export async function POST(request, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return authError();
    }

    const { id: botId } = await params;
    const body = await request.json();
    
    const { 
      apiKey, 
      models, 
      fallbackToGlobal = false, // Default to false when setting a custom key
      costTracking 
    } = body;

    // Validate required fields
    if (!apiKey || typeof apiKey !== 'string') {
      return validationError('Valid API key is required');
    }

    // Basic API key format validation
    if (!apiKey.startsWith('sk-')) {
      return validationError('Invalid API key format. OpenAI API keys start with "sk-"');
    }

    await connect();

    // Store the API key with validation
    const result = await apiKeyService.storeApiKey(botId, apiKey, userId, {
      models,
      fallbackToGlobal,
      costTracking
    });

    return apiSuccess({
      status: result.status,
      supportedModels: result.supportedModels,
      capabilities: result.capabilities,
      validationCosts: result.validationCosts
    }, 'API key configured successfully');

  } catch (error) {
    console.error('Set API key error:', error);
    
    // Handle different error types
    if (error.message.includes('Invalid API key')) {
      return validationError('Invalid API key', { originalError: error.message });
    }
    
    if (error.message.includes('Bot not found')) {
      return notFoundError('Bot');
    }

    return serverError('Failed to configure API key');
  }
}

/**
 * DELETE /api/bots/[id]/api-keys - Remove API key
 */
export async function DELETE(request, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return authError();
    }

    const { id: botId } = await params;
    await connect();

    await apiKeyService.removeApiKey(botId, userId);

    return apiSuccess(null, 'API key removed successfully. Bot will use global fallback key.');

  } catch (error) {
    console.error('Remove API key error:', error);
    
    if (error.message.includes('Bot not found')) {
      return notFoundError('Bot');
    }

    return serverError('Failed to remove API key');
  }
}