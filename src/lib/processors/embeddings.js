/**
 * Embeddings Generation Processor
 * 
 * Handles embedding generation using OpenAI with bot-specific API keys,
 * batch processing, and performance optimization.
 */

import { OpenAIEmbeddings } from '@langchain/openai';
import { logInfo, logError } from '../utils/logger.js';
import { createPerformanceTimer } from '../utils/performance.js';
import { createOpenAIClient } from '../integrations/openai.js';

/**
 * Default embedding configuration
 */
const DEFAULT_CONFIG = {
  model: 'text-embedding-3-small',
  batchSize: 100,
  maxRetries: 3,
  retryDelay: 1000,
  dimensions: 1536
};

/**
 * Create embeddings instance for a specific API key
 * @param {string} apiKey - OpenAI API key
 * @param {Object} config - Embedding configuration
 * @returns {OpenAIEmbeddings} Configured embeddings instance
 */
export function createEmbeddingsInstance(apiKey, config = {}) {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const embeddingConfig = {
    openAIApiKey: apiKey,
    model: config.model || DEFAULT_CONFIG.model,
    dimensions: config.dimensions || DEFAULT_CONFIG.dimensions,
    ...config
  };

  logInfo('Created embeddings instance', {
    model: embeddingConfig.model,
    dimensions: embeddingConfig.dimensions
  });

  return new OpenAIEmbeddings(embeddingConfig);
}

/**
 * Generate embeddings for a batch of texts
 * @param {string} apiKey - OpenAI API key
 * @param {Array<string>} texts - Array of texts to embed
 * @param {Object} options - Generation options
 * @returns {Promise<Array<Array<number>>>} Array of embedding vectors
 */
export async function generateEmbeddings(apiKey, texts, options = {}) {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    throw new Error('Texts array is required and must not be empty');
  }

  const {
    model = DEFAULT_CONFIG.model,
    batchSize = DEFAULT_CONFIG.batchSize,
    maxRetries = DEFAULT_CONFIG.maxRetries,
    retryDelay = DEFAULT_CONFIG.retryDelay
  } = options;

  const timer = createPerformanceTimer('Embedding Generation');

  try {
    logInfo('Starting embedding generation', {
      textsCount: texts.length,
      model,
      batchSize
    });

    const embeddings = createEmbeddingsInstance(apiKey, { model });
    const allEmbeddings = [];

    // Process in batches to avoid rate limits
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(texts.length / batchSize);

      logInfo('Processing embedding batch', {
        batch: batchNumber,
        totalBatches,
        batchSize: batch.length
      });

      const batchEmbeddings = await generateBatchWithRetry(
        embeddings, 
        batch, 
        maxRetries, 
        retryDelay,
        batchNumber
      );

      allEmbeddings.push(...batchEmbeddings);

      // Add small delay between batches to be respectful to the API
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const duration = timer.end({
      textsCount: texts.length,
      embeddingsGenerated: allEmbeddings.length,
      model
    });

    logInfo('Embedding generation completed', {
      totalTexts: texts.length,
      totalEmbeddings: allEmbeddings.length,
      avgTimePerText: Math.round(duration / texts.length) + 'ms',
      model
    });

    return allEmbeddings;
  } catch (error) {
    timer.end({ success: false, error: error.message });
    logError('Embedding generation failed', { error: error.message });
    throw error;
  }
}

/**
 * Generate embeddings for a batch with retry logic
 * @param {OpenAIEmbeddings} embeddings - Embeddings instance
 * @param {Array<string>} batch - Batch of texts
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} retryDelay - Delay between retries in ms
 * @param {number} batchNumber - Batch number for logging
 * @returns {Promise<Array<Array<number>>>} Batch embeddings
 */
async function generateBatchWithRetry(embeddings, batch, maxRetries, retryDelay, batchNumber) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const batchEmbeddings = await embeddings.embedDocuments(batch);
      
      if (attempt > 1) {
        logInfo('Batch retry successful', { 
          batchNumber, 
          attempt, 
          batchSize: batch.length 
        });
      }

      return batchEmbeddings;
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        
        logError('Batch embedding failed, retrying', {
          batchNumber,
          attempt,
          maxRetries,
          retryDelay: delay,
          error: error.message
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Failed to generate embeddings for batch ${batchNumber} after ${maxRetries} attempts: ${lastError.message}`);
}

/**
 * Generate single embedding for a text
 * @param {string} apiKey - OpenAI API key
 * @param {string} text - Text to embed
 * @param {Object} options - Generation options
 * @returns {Promise<Array<number>>} Embedding vector
 */
export async function generateSingleEmbedding(apiKey, text, options = {}) {
  const embeddings = await generateEmbeddings(apiKey, [text], options);
  return embeddings[0];
}

/**
 * Calculate embedding similarity (cosine similarity)
 * @param {Array<number>} embedding1 - First embedding vector
 * @param {Array<number>} embedding2 - Second embedding vector
 * @returns {number} Similarity score between -1 and 1
 */
export function calculateSimilarity(embedding1, embedding2) {
  if (!embedding1 || !embedding2) {
    throw new Error('Both embeddings are required');
  }

  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same dimensions');
  }

  // Calculate dot product
  let dotProduct = 0;
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
  }

  // Calculate magnitudes
  let magnitude1 = 0;
  let magnitude2 = 0;
  for (let i = 0; i < embedding1.length; i++) {
    magnitude1 += embedding1[i] * embedding1[i];
    magnitude2 += embedding2[i] * embedding2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  // Calculate cosine similarity
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Validate embedding dimensions and format
 * @param {Array<number>} embedding - Embedding vector to validate
 * @param {number} expectedDimensions - Expected number of dimensions
 * @returns {Object} Validation result
 */
export function validateEmbedding(embedding, expectedDimensions = DEFAULT_CONFIG.dimensions) {
  const errors = [];

  if (!Array.isArray(embedding)) {
    errors.push('Embedding must be an array');
    return { isValid: false, errors };
  }

  if (embedding.length !== expectedDimensions) {
    errors.push(`Embedding has ${embedding.length} dimensions, expected ${expectedDimensions}`);
  }

  // Check if all values are numbers
  const invalidValues = embedding.filter((value, index) => {
    return typeof value !== 'number' || isNaN(value) || !isFinite(value);
  });

  if (invalidValues.length > 0) {
    errors.push(`Found ${invalidValues.length} invalid values (NaN, Infinity, or non-numeric)`);
  }

  // Check if embedding is normalized (optional check)
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  const isNormalized = Math.abs(magnitude - 1.0) < 0.001;

  return {
    isValid: errors.length === 0,
    errors,
    magnitude,
    isNormalized,
    dimensions: embedding.length
  };
}

/**
 * Batch validate multiple embeddings
 * @param {Array<Array<number>>} embeddings - Array of embedding vectors
 * @param {number} expectedDimensions - Expected number of dimensions
 * @returns {Object} Batch validation result
 */
export function validateEmbeddings(embeddings, expectedDimensions = DEFAULT_CONFIG.dimensions) {
  if (!Array.isArray(embeddings)) {
    return { isValid: false, errors: ['Embeddings must be an array'] };
  }

  const results = embeddings.map((embedding, index) => ({
    index,
    ...validateEmbedding(embedding, expectedDimensions)
  }));

  const invalidCount = results.filter(result => !result.isValid).length;
  const allErrors = results.flatMap(result => 
    result.errors.map(error => `Index ${result.index}: ${error}`)
  );

  return {
    isValid: invalidCount === 0,
    totalCount: embeddings.length,
    validCount: embeddings.length - invalidCount,
    invalidCount,
    errors: allErrors,
    results
  };
}

/**
 * Estimate token usage for embedding generation
 * @param {Array<string>} texts - Array of texts
 * @param {string} model - Embedding model name
 * @returns {Object} Token usage estimation
 */
export function estimateTokenUsage(texts, model = DEFAULT_CONFIG.model) {
  const totalChars = texts.reduce((sum, text) => sum + text.length, 0);
  
  // Rough estimation: ~4 characters per token for most models
  const estimatedTokens = Math.ceil(totalChars / 4);
  
  // Get pricing per 1K tokens (these are approximate as of 2024)
  const pricing = {
    'text-embedding-3-small': 0.00002,
    'text-embedding-3-large': 0.00013,
    'text-embedding-ada-002': 0.0001
  };

  const costPer1K = pricing[model] || 0.0001;
  const estimatedCost = (estimatedTokens / 1000) * costPer1K;

  return {
    model,
    textsCount: texts.length,
    totalCharacters: totalChars,
    estimatedTokens,
    estimatedCostUSD: estimatedCost,
    costPer1K: costPer1K
  };
}
