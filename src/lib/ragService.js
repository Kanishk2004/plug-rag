import { generateEmbedding } from './embeddings.js';
import { searchVectors } from './qdrant.js';
import { getOpenAIClient } from './embeddings.js';
import Bot from '@/models/Bot.js';
import File from '@/models/File.js';
import Chunk from '@/models/Chunk.js';
import DashboardConversation from '@/models/DashboardConversation.js';
import Message from '@/models/Message.js';

// Logger utility for RAG operations
const ragLogger = {
  info: (operation, data) => console.log(`[RAG-${operation.toUpperCase()}] ℹ️`, data),
  success: (operation, data) => console.log(`[RAG-${operation.toUpperCase()}] ✅`, data),
  error: (operation, data) => console.log(`[RAG-${operation.toUpperCase()}] ❌`, data),
  debug: (operation, data) => console.log(`[RAG-${operation.toUpperCase()}] 🐛 DEBUG:`, data),
  timing: (operation) => {
    const start = Date.now();
    return {
      end: () => {
        const duration = Date.now() - start;
        console.log(`[RAG-${operation.toUpperCase()}] ⏱️ Completed in ${duration}ms`);
        return duration;
      }
    };
  }
};

/**
 * RAG Pipeline Service for Dashboard Chat
 * Handles document retrieval, context generation, and response creation
 */
class RAGService {
  constructor() {
    this.openaiClient = null;
    this.defaultModel = 'gpt-3.5-turbo';
    this.maxTokens = 500;
    this.temperature = 0.7;
    this.topK = 3; // Reduced from 5 to prevent token overload
    this.similarityThreshold = 0.7; // Minimum similarity score
    this.maxContextChars = 6000; // Conservative limit for document context
  }

  /**
   * Get or initialize OpenAI client
   */
  getOpenAIClient() {
    if (!this.openaiClient) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is required');
      }
      
      const { default: OpenAI } = require('openai');
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return this.openaiClient;
  }

  /**
   * Generate embedding for user query
   */
  async generateQueryEmbedding(query) {
    const timer = ragLogger.timing('query-embedding');
    
    try {
      ragLogger.info('query-embedding', { 
        query: query.substring(0, 100) + '...',
        queryLength: query.length 
      });
      
      const result = await generateEmbedding(query);
      
      if (!result.success) {
        throw new Error(`Failed to generate embedding: ${result.error}`);
      }
      
      ragLogger.success('query-embedding', {
        dimensions: result.dimensions,
        model: result.model
      });
      
      timer.end();
      return result.embedding;
      
    } catch (error) {
      ragLogger.error('query-embedding', {
        error: error.message,
        query: query.substring(0, 50) + '...'
      });
      timer.end();
      throw error;
    }
  }

  /**
   * Retrieve relevant documents using vector search
   */
  async retrieveRelevantDocuments(botId, queryEmbedding, topK = this.topK) {
    const timer = ragLogger.timing('document-retrieval');
    
    try {
      ragLogger.info('document-retrieval', { 
        botId, 
        topK,
        embeddingLength: queryEmbedding.length 
      });

      // Get bot and verify vector storage is enabled
      const bot = await Bot.findById(botId);
      if (!bot) {
        throw new Error(`Bot not found: ${botId}`);
      }

      if (!bot.vectorStorage?.enabled || !bot.vectorStorage?.collectionName) {
        throw new Error(`Vector storage not enabled for bot ${botId}`);
      }

      const collectionName = bot.vectorStorage.collectionName;
      
      ragLogger.debug('document-retrieval', {
        collectionName,
        vectorStorageConfig: bot.vectorStorage
      });

      // Perform vector search in Qdrant
      const searchResults = await searchVectors(
        collectionName,
        queryEmbedding,
        topK,
        this.similarityThreshold
      );

      ragLogger.debug('document-retrieval', {
        resultsCount: searchResults.length,
        scores: searchResults.map(r => r.score)
      });

      // Enhance results with chunk and file information
      const enhancedResults = await Promise.all(
        searchResults.map(async (result) => {
          try {
            // Get chunk information
            const chunk = await Chunk.findById(result.payload.chunkId);
            const file = await File.findById(result.payload.fileId);

            return {
              chunkId: result.payload.chunkId,
              fileId: result.payload.fileId,
              fileName: file?.originalName || 'Unknown File',
              content: result.payload.content,
              chunkIndex: result.payload.chunkIndex,
              similarityScore: result.score,
              metadata: {
                tokens: chunk?.tokens || 0,
                chunkType: chunk?.type || 'text',
                fileType: file?.fileType || 'unknown'
              }
            };
          } catch (error) {
            ragLogger.error('document-retrieval', {
              error: `Failed to enhance result: ${error.message}`,
              resultId: result.id
            });
            
            // Return minimal result if enhancement fails
            return {
              chunkId: result.payload.chunkId,
              fileId: result.payload.fileId,
              fileName: result.payload.fileName || 'Unknown File',
              content: result.payload.content,
              chunkIndex: result.payload.chunkIndex || 0,
              similarityScore: result.score,
              metadata: {}
            };
          }
        })
      );

      ragLogger.success('document-retrieval', {
        documentsRetrieved: enhancedResults.length,
        avgSimilarity: enhancedResults.reduce((sum, r) => sum + r.similarityScore, 0) / enhancedResults.length,
        sources: enhancedResults.map(r => ({
          file: r.fileName,
          score: r.similarityScore.toFixed(3)
        }))
      });

      timer.end();
      return enhancedResults;

    } catch (error) {
      ragLogger.error('document-retrieval', {
        error: error.message,
        botId,
        topK
      });
      timer.end();
      throw error;
    }
  }

  /**
   * Estimate token count for text (rough approximation)
   * OpenAI tokens are approximately 4 characters per token
   */
  estimateTokenCount(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate context prompt from retrieved documents with proper token management
   */
  generateContextPrompt(query, documents, botName = 'Assistant') {
    const timer = ragLogger.timing('context-generation');
    
    try {
      ragLogger.info('context-generation', {
        query: query.substring(0, 100) + '...',
        documentsCount: documents.length,
        botName
      });

      if (documents.length === 0) {
        ragLogger.debug('context-generation', { message: 'No documents provided, using no-context prompt' });
        
        const noContextPrompt = `You are ${botName}, a helpful AI assistant. A user has asked you a question, but no relevant documents were found in your knowledge base.

User Question: "${query}"

Please politely explain that you don't have information about this topic in your current knowledge base and suggest they:
1. Upload relevant documents about this topic
2. Rephrase their question to be more specific
3. Ask about topics related to the documents that have been uploaded

Be helpful and maintain a professional tone.`;

        timer.end();
        return noContextPrompt;
      }

      // Calculate token budgets for gpt-3.5-turbo (8192 token limit)
      const totalTokenLimit = 8192;
      const maxTokensReserved = 500; // Reserved for completion
      const systemInstructionsTokens = 400; // Estimated for system instructions
      const queryTokens = this.estimateTokenCount(query);
      
      // Available tokens for context documents
      const availableContextTokens = totalTokenLimit - maxTokensReserved - systemInstructionsTokens - queryTokens;
      
      ragLogger.debug('context-generation', {
        totalTokenLimit,
        availableContextTokens,
        queryTokens,
        systemInstructionsTokens
      });

      // Build context within token limits
      let context = '';
      let usedTokens = 0;
      let documentsUsed = 0;

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const docHeader = `Document ${i + 1} (${doc.fileName}, Relevance: ${(doc.similarityScore * 100).toFixed(1)}%):\n`;
        
        // Estimate tokens for this document section
        let docContent = doc.content.trim();
        const docHeaderTokens = this.estimateTokenCount(docHeader);
        const docContentTokens = this.estimateTokenCount(docContent);
        const separatorTokens = 10; // For separators between docs
        
        const totalDocTokens = docHeaderTokens + docContentTokens + separatorTokens;
        
        // If this document would exceed the limit, truncate it
        if (usedTokens + totalDocTokens > availableContextTokens) {
          const remainingTokens = availableContextTokens - usedTokens - docHeaderTokens - separatorTokens;
          
          if (remainingTokens > 100) { // Only include if we have meaningful space
            // Truncate the document content to fit
            const maxContentChars = remainingTokens * 4; // Convert tokens back to chars
            docContent = docContent.substring(0, maxContentChars) + '\n[Content truncated...]';
            
            const docSection = `${docHeader}${docContent}`;
            context += (context ? '\n\n---\n\n' : '') + docSection;
            documentsUsed++;
            
            ragLogger.debug('context-generation', {
              message: 'Document truncated to fit token limit',
              documentIndex: i,
              originalLength: doc.content.length,
              truncatedLength: docContent.length,
              remainingTokens
            });
          }
          break;
        } else {
          // Document fits completely
          const docSection = `${docHeader}${docContent}`;
          context += (context ? '\n\n---\n\n' : '') + docSection;
          usedTokens += totalDocTokens;
          documentsUsed++;
        }
      }

      // If no documents could fit, use a minimal context
      if (documentsUsed === 0 && documents.length > 0) {
        const firstDoc = documents[0];
        const miniContent = firstDoc.content.substring(0, 500) + '...';
        context = `Document 1 (${firstDoc.fileName}, Relevance: ${(firstDoc.similarityScore * 100).toFixed(1)}%):\n${miniContent}`;
        documentsUsed = 1;
        
        ragLogger.debug('context-generation', {
          message: 'Used minimal context due to token constraints',
          miniContentLength: miniContent.length
        });
      }

      const systemPrompt = `You are ${botName}, a helpful AI assistant. Use the provided documents to answer the user's question accurately and helpfully.

IMPORTANT GUIDELINES:
1. Base your answer primarily on the provided documents
2. If the documents don't contain relevant information, say so clearly
3. Don't make up information not found in the documents
4. Be specific and cite which documents you're referencing when relevant
5. Keep responses concise but complete
6. If asked about topics not covered in the documents, politely redirect to topics that are covered

CONTEXT DOCUMENTS:
${context}

USER QUESTION: "${query}"

Please provide a helpful response based on the above documents.`;

      const finalTokenEstimate = this.estimateTokenCount(systemPrompt);

      ragLogger.success('context-generation', {
        contextLength: context.length,
        promptLength: systemPrompt.length,
        documentsUsed,
        totalDocuments: documents.length,
        estimatedTokens: finalTokenEstimate,
        tokenBudgetUsed: `${finalTokenEstimate}/${totalTokenLimit}`
      });

      // Final safety check
      if (finalTokenEstimate > totalTokenLimit - maxTokensReserved) {
        ragLogger.error('context-generation', {
          error: 'Final prompt still exceeds token limit after truncation',
          estimatedTokens: finalTokenEstimate,
          limit: totalTokenLimit - maxTokensReserved
        });
        
        // Emergency fallback - use only the query
        const emergencyPrompt = `You are ${botName}, a helpful AI assistant. A user has asked: "${query}". Please provide a helpful response, but note that the context documents were too large to process. Suggest the user try a more specific question.`;
        
        timer.end();
        return emergencyPrompt;
      }

      timer.end();
      return systemPrompt;

    } catch (error) {
      ragLogger.error('context-generation', {
        error: error.message,
        documentsCount: documents.length
      });
      timer.end();
      throw error;
    }
  }

  /**
   * Generate response using OpenAI
   */
  async generateResponse(prompt, settings = {}) {
    const timer = ragLogger.timing('response-generation');
    
    try {
      const model = settings.model || this.defaultModel;
      const maxTokens = settings.maxTokens || this.maxTokens;
      const temperature = settings.temperature || this.temperature;

      // Estimate prompt tokens to ensure we don't exceed limits
      const estimatedPromptTokens = this.estimateTokenCount(prompt);
      const modelContextLimit = model === 'gpt-3.5-turbo' ? 8192 : 4096;
      
      ragLogger.info('response-generation', {
        model,
        maxTokens,
        temperature,
        promptLength: prompt.length,
        estimatedPromptTokens,
        modelContextLimit
      });

      // Safety check for token limits
      if (estimatedPromptTokens + maxTokens > modelContextLimit) {
        ragLogger.error('response-generation', {
          error: 'Prompt + completion would exceed model context limit',
          estimatedPromptTokens,
          maxTokens,
          total: estimatedPromptTokens + maxTokens,
          limit: modelContextLimit
        });
        
        throw new Error(`Prompt too long for model context. Estimated tokens: ${estimatedPromptTokens}, Limit: ${modelContextLimit}`);
      }

      const client = this.getOpenAIClient();
      
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      });

      if (!response.choices || response.choices.length === 0) {
        throw new Error('No response generated from OpenAI');
      }

      const responseText = response.choices[0].message.content;
      const usage = response.usage;

      ragLogger.success('response-generation', {
        model,
        responseLength: responseText.length,
        tokensUsed: usage.total_tokens,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens
      });

      const duration = timer.end();
      
      return {
        content: responseText,
        metadata: {
          model,
          usage,
          responseTime: duration,
          finishReason: response.choices[0].finish_reason
        }
      };

    } catch (error) {
      ragLogger.error('response-generation', {
        error: error.message,
        model: settings.model || this.defaultModel
      });
      timer.end();
      
      // Handle specific OpenAI errors
      if (error.message.includes('maximum context length')) {
        throw new Error('Context too long for AI model. Please try a shorter or more specific question.');
      }
      
      if (error.status === 429) {
        throw new Error('AI service temporarily busy. Please try again in a moment.');
      }
      
      if (error.status === 401) {
        throw new Error('AI service authentication error. Please contact support.');
      }
      
      throw error;
    }
  }

  /**
   * Main RAG pipeline: Process user query and generate response
   */
  async processQuery(botId, userId, query, settings = {}) {
    const overallTimer = ragLogger.timing('rag-pipeline');
    
    try {
      ragLogger.info('rag-pipeline', {
        botId,
        userId,
        query: query.substring(0, 100) + '...',
        queryLength: query.length
      });

      // Step 1: Get or create conversation
      const conversation = await DashboardConversation.getOrCreateActiveConversation(botId, userId);
      
      // Step 2: Create user message
      const userMessage = await Message.createUserMessage(conversation._id, botId, userId, query);
      
      // Step 3: Update conversation analytics
      await conversation.addMessage('user');

      // Step 4: Generate query embedding
      const queryEmbedding = await this.generateQueryEmbedding(query);

      // Step 5: Retrieve relevant documents
      const documents = await this.retrieveRelevantDocuments(botId, queryEmbedding, settings.topK || this.topK);

      // Step 6: Generate context prompt
      const bot = await Bot.findById(botId);
      const prompt = this.generateContextPrompt(query, documents, bot?.name || 'Assistant');

      // Step 7: Generate response
      const responseData = await this.generateResponse(prompt, settings);

      // Step 8: Create assistant message with sources
      const sources = documents.map(doc => ({
        documentId: doc.fileId,
        chunkId: doc.chunkId,
        fileName: doc.fileName,
        chunkContent: doc.content.substring(0, 200) + '...',
        similarityScore: doc.similarityScore,
        retrievedAt: new Date()
      }));

      const assistantMessage = await Message.createAssistantMessage(
        conversation._id,
        botId,
        userId,
        responseData.content,
        sources
      );

      // Step 9: Update message metadata
      await assistantMessage.markAsCompleted({
        ...responseData.metadata,
        sourcesCount: sources.length,
        confidence: documents.length > 0 ? documents[0].similarityScore : 0,
        retrievalTime: 0 // Will be calculated from logs
      });

      // Step 10: Update conversation analytics
      await conversation.addMessage('assistant', responseData.metadata.usage?.total_tokens || 0);
      await conversation.updateAnalytics({
        responseTime: responseData.metadata.responseTime,
        sourcesCount: sources.length,
        confidence: documents.length > 0 ? documents[0].similarityScore : 0
      });

      const totalDuration = overallTimer.end();

      ragLogger.success('rag-pipeline', {
        conversationId: conversation._id,
        userMessageId: userMessage._id,
        assistantMessageId: assistantMessage._id,
        totalDuration,
        sourcesUsed: sources.length,
        tokensUsed: responseData.metadata.usage?.total_tokens || 0
      });

      return {
        success: true,
        conversation,
        userMessage,
        assistantMessage,
        sources,
        metadata: {
          totalDuration,
          ...responseData.metadata
        }
      };

    } catch (error) {
      ragLogger.error('rag-pipeline', {
        error: error.message,
        stack: error.stack,
        botId,
        userId
      });
      
      overallTimer.end();
      throw error;
    }
  }

  /**
   * Generate suggested questions based on uploaded documents
   */
  async generateSuggestedQuestions(botId) {
    const timer = ragLogger.timing('suggested-questions');
    
    try {
      ragLogger.info('suggested-questions', { botId });

      // Get bot and recent files
      const bot = await Bot.findById(botId);
      if (!bot) {
        throw new Error(`Bot not found: ${botId}`);
      }

      const files = await File.find({ botId }).sort({ createdAt: -1 }).limit(3);
      
      if (files.length === 0) {
        ragLogger.debug('suggested-questions', { message: 'No files found, returning default questions' });
        timer.end();
        return [
          "What documents have been uploaded?",
          "Can you summarize the main topics covered?",
          "What information is available in your knowledge base?"
        ];
      }

      // Get sample chunks from recent files
      const sampleChunks = await Promise.all(
        files.map(async (file) => {
          const chunks = await Chunk.find({ fileId: file._id }).limit(2);
          return chunks.map(chunk => ({
            fileName: file.originalName,
            content: chunk.content.substring(0, 300)
          }));
        })
      );

      const flatChunks = sampleChunks.flat();
      
      // Generate context for question generation
      const context = flatChunks.map((chunk, index) => 
        `Document: ${chunk.fileName}\nSample: ${chunk.content}...`
      ).join('\n\n');

      const prompt = `Based on the following document samples, generate 3 specific, useful questions that a user might ask about this content. Make the questions diverse and cover different aspects of the documents.

DOCUMENT SAMPLES:
${context}

Generate exactly 3 questions that are:
1. Specific to the content shown
2. Likely to have good answers in the documents
3. Different from each other in focus/topic
4. Practical and useful for testing the bot

Format as a simple list:
1. [Question 1]
2. [Question 2]
3. [Question 3]`;

      const client = this.getOpenAIClient();
      const response = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.8
      });

      let questions = response.choices[0].message.content
        .split('\n')
        .filter(line => line.match(/^\d+\./))
        .map(line => line.replace(/^\d+\.\s*/, ''))
        .slice(0, 3);

      // Fallback if parsing fails
      if (questions.length < 3) {
        questions = [
          `What information is available about ${files[0].originalName}?`,
          "Can you summarize the main topics covered in the documents?",
          "What are the key points I should know from these files?"
        ];
      }

      ragLogger.success('suggested-questions', {
        questionsGenerated: questions.length,
        filesAnalyzed: files.length,
        questions
      });

      timer.end();
      return questions;

    } catch (error) {
      ragLogger.error('suggested-questions', {
        error: error.message,
        botId
      });
      
      timer.end();
      
      // Return default questions on error
      return [
        "What documents have been uploaded?",
        "Can you summarize the main topics covered?",
        "What information is available in your knowledge base?"
      ];
    }
  }
}

// Export singleton instance
const ragService = new RAGService();

export default ragService;

// Export individual functions for flexibility
export {
  ragService,
  RAGService
};