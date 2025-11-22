import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { validateOpenAIKey } from '@/lib/integrations/openai.js';
import {
  apiSuccess,
  authError,
  validationError,
  serverError
} from '@/lib/utils/apiResponse';

/**
 * POST /api/bots/[id]/api-keys/validate - Validate API key without storing
 * This endpoint allows users to test their API key before saving it
 */
export async function POST(request, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return authError();
    }

    const { apiKey } = await request.json();

    // Validate input
    if (!apiKey || typeof apiKey !== 'string') {
      return validationError('API key is required');
    }

    // Basic format validation
    if (!apiKey.startsWith('sk-')) {
      return validationError('Invalid API key format. OpenAI API keys start with "sk-"');
    }

    // Validate the API key with OpenAI
    const validation = await validateOpenAIKey(apiKey);

    if (validation.isValid) {
      return apiSuccess({
        isValid: true,
        supportedModels: validation.supportedModels,
        capabilities: validation.capabilities,
        validationCosts: validation.validationCosts,
        testedAt: validation.testedAt
      }, 'API key is valid and ready to use');
    } else {
      return validationError('API key validation failed', {
        isValid: false,
        error: validation.error,
        errorCode: validation.errorCode,
        status: validation.status,
        testedAt: validation.testedAt
      });
    }

  } catch (error) {
    console.error('Validate API key error:', error);
    return serverError('Failed to validate API key');
  }
}