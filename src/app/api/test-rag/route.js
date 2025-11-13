import { ragService } from '@/lib/ragService';
import { apiSuccess, serverError } from '@/lib/apiResponse';

/**
 * Test endpoint for RAG functionality
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const botId = searchParams.get('botId');
    const query = searchParams.get('query');

    if (!botId || !query) {
      return Response.json({
        success: false,
        error: 'botId and query parameters are required'
      }, { status: 400 });
    }

    // Test RAG service
    const response = await ragService.generateResponse(
      botId,
      query,
      [],
      { name: 'Test Bot', description: 'A test bot' }
    );

    return apiSuccess({
      query: query,
      botId: botId,
      response: response.content,
      sources: response.sources,
      tokensUsed: response.tokensUsed,
      responseTime: response.responseTime,
      hasRelevantContext: response.hasRelevantContext
    }, 'RAG test completed successfully');

  } catch (error) {
    console.error('RAG test error:', error);
    return serverError(`RAG test failed: ${error.message}`);
  }
}