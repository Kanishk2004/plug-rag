/**
 * Text Chunking Processor
 * 
 * Handles intelligent text segmentation using recursive character splitting
 * optimized for different content types and embedding models.
 */

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { encoding_for_model } from 'tiktoken';
import { logInfo, logError } from '../utils/logger.js';

const DEFAULT_CHUNK_SIZE = 700;
const DEFAULT_CHUNK_OVERLAP = 100;
const DEFAULT_SEPARATORS = ['\n\n', '\n', ' ', ''];

/**
 * Chunk text into LangChain Document objects
 * @param {string} text - Text to chunk
 * @param {Object} metadata - Base metadata for all chunks
 * @param {Object} options - Chunking options
 * @returns {Promise<Array<Document>>} Array of document chunks
 */
export async function chunkText(text, metadata = {}, options = {}) {
  if (!text || typeof text !== 'string') {
    throw new Error('Text content is required and must be a string');
  }

  const {
    maxChunkSize = DEFAULT_CHUNK_SIZE,
    overlap = DEFAULT_CHUNK_OVERLAP,
    separators = DEFAULT_SEPARATORS,
    contentType = 'text'
  } = options;

  logInfo('Starting text chunking', {
    textLength: text.length,
    maxChunkSize,
    overlap,
    contentType
  });

  try {
    // Get optimal separators based on content type
    const optimalSeparators = getOptimalSeparators(contentType, separators);

    // Create text splitter with configuration
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: maxChunkSize,
      chunkOverlap: overlap,
      separators: optimalSeparators,
    });

    const startTime = Date.now();

    // Split the text into chunks
    const textChunks = await splitter.splitText(text);

    const processingTime = Date.now() - startTime;

    if (textChunks.length === 0) {
      throw new Error('Text splitting resulted in no chunks - content may be too short');
    }

    // Calculate token usage for all chunks
    const totalTokens = calculateTotalTokens(textChunks);

    // Create LangChain Document objects with enriched metadata
    const documents = textChunks.map((chunk, index) => {
      const chunkTokens = getAccurateTokenCount(chunk);
      
      const enrichedMetadata = {
        ...metadata,
        chunk: index + 1,
        totalChunks: textChunks.length,
        chunkSize: chunk.length,
        tokenCount: chunkTokens,
        chunkOverlap: overlap,
        maxChunkSize,
        contentType,
        processedAt: new Date().toISOString(),
        processingTime
      };

      return new Document({
        pageContent: chunk,
        metadata: enrichedMetadata
      });
    });

    logInfo('Text chunking completed', {
      originalLength: text.length,
      totalChunks: documents.length,
      avgChunkSize: Math.round(text.length / documents.length),
      totalTokens,
      processingTime: `${processingTime}ms`
    });

    return documents;
  } catch (error) {
    logError('Text chunking failed', { error: error.message });
    throw error;
  }
}

/**
 * Get optimal separators based on content type
 * @param {string} contentType - Type of content being chunked
 * @param {Array} defaultSeparators - Default separators to fall back to
 * @returns {Array} Optimal separators for the content type
 */
function getOptimalSeparators(contentType, defaultSeparators) {
  switch (contentType.toLowerCase()) {
    case 'markdown':
    case 'md':
      return ['\n## ', '\n### ', '\n#### ', '\n\n', '\n', ' ', ''];
    
    case 'code':
    case 'javascript':
    case 'python':
      return ['\nfunction ', '\nclass ', '\ndef ', '\n\n', '\n', ' ', ''];
    
    case 'html':
      return ['</div>', '</p>', '</section>', '\n\n', '\n', ' ', ''];
    
    case 'csv':
      return ['\n', ',', ' ', ''];
    
    case 'pdf':
      return ['\n\n', '\n', '. ', ' ', ''];
    
    default:
      return defaultSeparators;
  }
}

/**
 * Calculate accurate token count for text using tiktoken
 * @param {string} text - Text to count tokens for
 * @param {string} model - Model name for token encoding
 * @returns {number} Token count
 */
export function getAccurateTokenCount(text, model = 'text-embedding-3-small') {
  try {
    // Use tiktoken for accurate token counting
    const encoder = encoding_for_model(model);
    const tokens = encoder.encode(text);
    encoder.free(); // Clean up encoder
    return tokens.length;
  } catch (error) {
    // Fallback to rough estimation if tiktoken fails
    logError('Token counting failed, using estimation', { error: error.message });
    return Math.ceil(text.length / 4); // Rough estimate: ~4 chars per token
  }
}

/**
 * Calculate total tokens for an array of text chunks
 * @param {Array} chunks - Array of text chunks
 * @param {string} model - Model name for token encoding
 * @returns {number} Total token count
 */
function calculateTotalTokens(chunks, model = 'text-embedding-3-small') {
  return chunks.reduce((total, chunk) => {
    return total + getAccurateTokenCount(chunk, model);
  }, 0);
}

/**
 * Optimize chunk size based on content characteristics
 * @param {string} text - Text to analyze
 * @param {Object} options - Current chunking options
 * @returns {Object} Optimized chunking options
 */
export function optimizeChunkSize(text, options = {}) {
  const { maxChunkSize = DEFAULT_CHUNK_SIZE } = options;
  
  // Analyze text characteristics
  const avgLineLength = getAverageLineLength(text);
  const avgParagraphLength = getAverageParagraphLength(text);
  const hasStructure = hasStructuralElements(text);

  let optimizedChunkSize = maxChunkSize;
  let optimizedOverlap = options.overlap || DEFAULT_CHUNK_OVERLAP;

  // Adjust based on content structure
  if (hasStructure) {
    // Structured content can handle larger chunks
    optimizedChunkSize = Math.max(maxChunkSize, 1000);
    optimizedOverlap = Math.max(optimizedOverlap, 150);
  } else if (avgLineLength < 50) {
    // Short lines (like code or lists) need smaller chunks
    optimizedChunkSize = Math.min(maxChunkSize, 500);
    optimizedOverlap = Math.min(optimizedOverlap, 50);
  } else if (avgParagraphLength > 500) {
    // Long paragraphs need larger chunks to maintain context
    optimizedChunkSize = Math.max(maxChunkSize, 1200);
    optimizedOverlap = Math.max(optimizedOverlap, 200);
  }

  logInfo('Chunk size optimization completed', {
    originalChunkSize: maxChunkSize,
    optimizedChunkSize,
    originalOverlap: options.overlap || DEFAULT_CHUNK_OVERLAP,
    optimizedOverlap,
    avgLineLength,
    avgParagraphLength,
    hasStructure
  });

  return {
    ...options,
    maxChunkSize: optimizedChunkSize,
    overlap: optimizedOverlap
  };
}

/**
 * Get average line length in text
 * @param {string} text - Text to analyze
 * @returns {number} Average line length
 */
function getAverageLineLength(text) {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  if (lines.length === 0) return 0;
  
  const totalLength = lines.reduce((sum, line) => sum + line.length, 0);
  return totalLength / lines.length;
}

/**
 * Get average paragraph length in text
 * @param {string} text - Text to analyze
 * @returns {number} Average paragraph length
 */
function getAverageParagraphLength(text) {
  const paragraphs = text.split('\n\n').filter(para => para.trim().length > 0);
  if (paragraphs.length === 0) return 0;
  
  const totalLength = paragraphs.reduce((sum, para) => sum + para.length, 0);
  return totalLength / paragraphs.length;
}

/**
 * Check if text has structural elements (headers, lists, etc.)
 * @param {string} text - Text to analyze
 * @returns {boolean} Whether text has structural elements
 */
function hasStructuralElements(text) {
  // Check for common structural patterns
  const patterns = [
    /^#{1,6}\s+/m,           // Markdown headers
    /^\d+\.\s+/m,            // Numbered lists
    /^[-*+]\s+/m,            // Bullet lists
    /^.+:\s*$/m,             // Key-value pairs or definitions
    /<h[1-6]>/i,             // HTML headers
    /<p>/i,                  // HTML paragraphs
    /\n\s*\n.+\n\s*-{3,}/    // Underlined headers
  ];

  return patterns.some(pattern => pattern.test(text));
}

/**
 * Validate chunk quality and suggest improvements
 * @param {Array} documents - Array of document chunks
 * @returns {Object} Quality analysis and suggestions
 */
export function validateChunkQuality(documents) {
  if (!documents || documents.length === 0) {
    return { isValid: false, issues: ['No chunks provided'] };
  }

  const issues = [];
  const suggestions = [];
  
  // Check for very small chunks
  const smallChunks = documents.filter(doc => doc.pageContent.length < 100);
  if (smallChunks.length > documents.length * 0.1) { // More than 10% are small
    issues.push(`${smallChunks.length} chunks are very small (<100 characters)`);
    suggestions.push('Consider reducing overlap or increasing chunk size');
  }

  // Check for very large chunks
  const largeChunks = documents.filter(doc => doc.pageContent.length > 2000);
  if (largeChunks.length > 0) {
    issues.push(`${largeChunks.length} chunks are very large (>2000 characters)`);
    suggestions.push('Consider reducing chunk size for better retrieval');
  }

  // Check token distribution
  const tokenCounts = documents.map(doc => doc.metadata.tokenCount || 0);
  const avgTokens = tokenCounts.reduce((sum, count) => sum + count, 0) / tokenCounts.length;
  const maxTokens = Math.max(...tokenCounts);
  
  if (maxTokens > 1000) {
    issues.push('Some chunks exceed recommended token limit (1000)');
    suggestions.push('Reduce chunk size to stay within embedding model limits');
  }

  return {
    isValid: issues.length === 0,
    issues,
    suggestions,
    stats: {
      totalChunks: documents.length,
      avgChunkSize: Math.round(documents.reduce((sum, doc) => sum + doc.pageContent.length, 0) / documents.length),
      avgTokenCount: Math.round(avgTokens),
      maxTokenCount: maxTokens,
      smallChunksCount: smallChunks.length,
      largeChunksCount: largeChunks.length
    }
  };
}