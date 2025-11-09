/**
 * Main text extractor that handles all file types
 * Optimized for vector embeddings and RAG applications
 */

import { extractFromPDF, chunkPDFText } from './pdf.js';
import { extractFromDOCX, chunkDOCXText } from './docx.js';
import { extractFromTXT, chunkTXTText } from './txt.js';
import { extractFromCSV, chunkCSVText } from './csv.js';
import { extractFromHTML, chunkHTMLText } from './html.js';
import { extractFallback } from './fallback.js';
import { PerformanceMonitor } from '../performance.js';

/**
 * Universal text extractor - automatically detects file type and extracts text
 * 
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @param {Object} options - Extraction options
 * @returns {Object} Extracted text data with metadata
 */
export async function extractText(buffer, filename, options = {}) {
  try {
    PerformanceMonitor.startTimer('universal-extraction');
    
    const fileType = detectFileType(filename, buffer);
    const extractOptions = {
      fileType,
      originalFilename: filename,
      ...options,
    };

    let result;
    
    try {
      switch (fileType) {
        case 'pdf':
          result = await extractFromPDF(buffer, extractOptions);
          break;
          
        case 'docx':
          result = await extractFromDOCX(buffer, extractOptions);
          break;
          
        case 'txt':
          result = await extractFromTXT(buffer, extractOptions);
          break;
          
        case 'csv':
          result = await extractFromCSV(buffer, extractOptions);
          break;
          
        case 'html':
          result = await extractFromHTML(buffer, extractOptions);
          break;
          
        default:
          console.warn(`Unsupported file type: ${fileType}, using fallback extraction`);
          result = await extractFallback(buffer, filename, extractOptions);
      }
    } catch (extractorError) {
      console.warn(`Extraction failed for ${fileType}, trying fallback:`, extractorError.message);
      result = await extractFallback(buffer, filename, extractOptions);
    }

    // Add universal metadata
    result.metadata = {
      ...result.metadata,
      originalFilename: filename,
      detectedFileType: fileType,
      extractionMethod: 'universal',
    };

    PerformanceMonitor.endTimer('universal-extraction');
    return result;

  } catch (error) {
    PerformanceMonitor.endTimer('universal-extraction', 'error');
    console.error('Universal extraction error:', error);
    throw new Error(`Failed to extract text from ${filename}: ${error.message}`);
  }
}

/**
 * Extract text from web URL
 * 
 * @param {string} url - Web URL to extract from
 * @param {Object} options - Extraction options
 * @returns {Object} Extracted text data with metadata
 */
export async function extractFromURL(url, options = {}) {
  try {
    PerformanceMonitor.startTimer('url-extraction');
    
    const urlOptions = {
      isURL: true,
      ...options,
    };

    const result = await extractFromHTML(url, urlOptions);
    
    // Add URL-specific metadata
    result.metadata = {
      ...result.metadata,
      sourceURL: url,
      extractionMethod: 'url',
    };

    PerformanceMonitor.endTimer('url-extraction');
    return result;

  } catch (error) {
    PerformanceMonitor.endTimer('url-extraction', 'error');
    console.error('URL extraction error:', error);
    throw new Error(`Failed to extract text from URL ${url}: ${error.message}`);
  }
}

/**
 * Universal text chunker - automatically chunks based on file type
 * 
 * @param {string} text - Extracted text
 * @param {Object} extractedData - Full extraction result
 * @param {Object} options - Chunking options
 * @returns {Array} Text chunks optimized for embeddings
 */
export function chunkText(text, extractedData, options = {}) {
  try {
    PerformanceMonitor.startTimer('universal-chunking');
    
    const fileType = extractedData.metadata?.fileType || 'txt';
    const chunkOptions = {
      maxChunkSize: 500, // Reduced from 700 to prevent embedding token limit issues
      overlap: 50, // Reduced from 100 to keep chunks smaller
      maxTokens: 6000, // Maximum tokens per chunk (well under 8192 embedding limit)
      ...options,
    };

    let chunks;
    
    switch (fileType) {
      case 'pdf':
        chunks = chunkPDFText(text, chunkOptions);
        break;
        
      case 'docx':
        chunks = chunkDOCXText(text, extractedData.structuredContent, chunkOptions);
        break;
        
      case 'txt':
        chunks = chunkTXTText(text, extractedData.structure, chunkOptions);
        break;
        
      case 'csv':
        chunks = chunkCSVText(text, extractedData.structure, extractedData.data, chunkOptions);
        break;
        
      case 'html':
        chunks = chunkHTMLText(text, extractedData.structure, chunkOptions);
        break;
        
      default:
        // Fallback to simple text chunking
        chunks = chunkTXTText(text, {}, chunkOptions);
    }

    // Add universal chunk metadata and validate token limits
    chunks = chunks.map((chunk, index) => ({
      ...chunk,
      id: generateChunkId(extractedData.metadata?.originalFilename || 'unknown', index),
      sourceFileType: fileType,
      extractedAt: new Date().toISOString(),
    }));

    // Post-process chunks to ensure they don't exceed token limits
    const validatedChunks = [];
    const maxTokensPerChunk = chunkOptions.maxTokens || 6000;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const estimatedTokens = Math.ceil(chunk.content.length / 4); // Rough token estimate
      
      if (estimatedTokens <= maxTokensPerChunk) {
        // Chunk is within limits
        validatedChunks.push(chunk);
      } else {
        // Chunk is too large, split it
        console.warn(`Chunk ${i} exceeds token limit (${estimatedTokens} tokens), splitting...`);
        
        const subChunks = splitLargeChunk(chunk, maxTokensPerChunk);
        validatedChunks.push(...subChunks);
      }
    }

    PerformanceMonitor.endTimer('universal-chunking');
    return validatedChunks;

  } catch (error) {
    PerformanceMonitor.endTimer('universal-chunking', 'error');
    console.error('Universal chunking error:', error);
    throw new Error(`Failed to chunk text: ${error.message}`);
  }
}

/**
 * Split a large chunk into smaller sub-chunks that fit within token limits
 */
function splitLargeChunk(chunk, maxTokens) {
  const maxChars = maxTokens * 4; // Convert tokens to approximate characters
  const content = chunk.content;
  const subChunks = [];
  
  // Split by sentences first, then by paragraphs if needed
  const sentences = content.split(/[.!?]+\s+/);
  let currentChunk = '';
  let chunkIndex = 0;
  
  for (const sentence of sentences) {
    const proposedChunk = currentChunk + (currentChunk ? '. ' : '') + sentence;
    
    if (proposedChunk.length <= maxChars) {
      currentChunk = proposedChunk;
    } else {
      // Save current chunk if it has content
      if (currentChunk.trim()) {
        subChunks.push({
          ...chunk,
          id: `${chunk.id}_split_${chunkIndex}`,
          content: currentChunk.trim(),
          tokens: Math.ceil(currentChunk.length / 4),
          chunkIndex: chunk.chunkIndex + chunkIndex / 100, // Maintain ordering
          metadata: {
            ...chunk.metadata,
            isSplit: true,
            originalChunkId: chunk.id,
            splitIndex: chunkIndex
          }
        });
        chunkIndex++;
      }
      
      // Start new chunk with current sentence
      if (sentence.length > maxChars) {
        // Sentence itself is too long, force split by characters
        const forceSplit = splitByCharacters(sentence, maxChars);
        for (let j = 0; j < forceSplit.length; j++) {
          subChunks.push({
            ...chunk,
            id: `${chunk.id}_split_${chunkIndex}`,
            content: forceSplit[j],
            tokens: Math.ceil(forceSplit[j].length / 4),
            chunkIndex: chunk.chunkIndex + chunkIndex / 100,
            metadata: {
              ...chunk.metadata,
              isSplit: true,
              isForceplit: true,
              originalChunkId: chunk.id,
              splitIndex: chunkIndex
            }
          });
          chunkIndex++;
        }
        currentChunk = '';
      } else {
        currentChunk = sentence;
      }
    }
  }
  
  // Add final chunk if there's remaining content
  if (currentChunk.trim()) {
    subChunks.push({
      ...chunk,
      id: `${chunk.id}_split_${chunkIndex}`,
      content: currentChunk.trim(),
      tokens: Math.ceil(currentChunk.length / 4),
      chunkIndex: chunk.chunkIndex + chunkIndex / 100,
      metadata: {
        ...chunk.metadata,
        isSplit: true,
        originalChunkId: chunk.id,
        splitIndex: chunkIndex
      }
    });
  }
  
  console.log(`Split large chunk into ${subChunks.length} sub-chunks`);
  return subChunks;
}

/**
 * Force split text by characters when sentences are too long
 */
function splitByCharacters(text, maxChars) {
  const chunks = [];
  const overlap = Math.min(100, maxChars * 0.1); // 10% overlap or 100 chars, whichever is smaller
  
  for (let i = 0; i < text.length; i += maxChars - overlap) {
    const chunk = text.substring(i, i + maxChars);
    chunks.push(chunk);
    
    if (i + maxChars >= text.length) break;
  }
  
  return chunks;
}

/**
 * Process file completely - extract text and create chunks in one go
 * 
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @param {Object} options - Processing options
 * @returns {Object} Complete processing result with text and chunks
 */
export async function processFile(buffer, filename, options = {}) {
  try {
    PerformanceMonitor.startTimer('complete-file-processing');
    
    // Extract text
    const extractedData = await extractText(buffer, filename, options);
    
    // Create chunks
    const chunks = chunkText(extractedData.text, extractedData, options);
    
    const result = {
      ...extractedData,
      chunks: chunks,
      processing: {
        totalChunks: chunks.length,
        averageChunkSize: chunks.reduce((sum, chunk) => sum + chunk.tokens, 0) / chunks.length,
        processedAt: new Date().toISOString(),
      },
    };

    PerformanceMonitor.endTimer('complete-file-processing');
    return result;

  } catch (error) {
    PerformanceMonitor.endTimer('complete-file-processing', 'error');
    console.error('Complete file processing error:', error);
    throw error;
  }
}

/**
 * Process web URL completely - extract text and create chunks
 * 
 * @param {string} url - Web URL
 * @param {Object} options - Processing options
 * @returns {Object} Complete processing result with text and chunks
 */
export async function processURL(url, options = {}) {
  try {
    PerformanceMonitor.startTimer('complete-url-processing');
    
    // Extract text from URL
    const extractedData = await extractFromURL(url, options);
    
    // Create chunks
    const chunks = chunkText(extractedData.text, extractedData, options);
    
    const result = {
      ...extractedData,
      chunks: chunks,
      processing: {
        totalChunks: chunks.length,
        averageChunkSize: chunks.reduce((sum, chunk) => sum + chunk.tokens, 0) / chunks.length,
        processedAt: new Date().toISOString(),
      },
    };

    PerformanceMonitor.endTimer('complete-url-processing');
    return result;

  } catch (error) {
    PerformanceMonitor.endTimer('complete-url-processing', 'error');
    console.error('Complete URL processing error:', error);
    throw error;
  }
}

/**
 * Detect file type from filename and buffer
 */
function detectFileType(filename, buffer) {
  // First, try to detect from filename extension
  const extension = filename.toLowerCase().split('.').pop();
  
  const extensionMap = {
    'pdf': 'pdf',
    'docx': 'docx',
    'doc': 'docx', // Treat .doc as .docx for now
    'txt': 'txt',
    'text': 'txt',
    'csv': 'csv',
    'html': 'html',
    'htm': 'html',
  };
  
  if (extensionMap[extension]) {
    return extensionMap[extension];
  }
  
  // Fallback: detect from buffer magic numbers
  return detectFileTypeFromBuffer(buffer);
}

/**
 * Detect file type from buffer magic numbers
 */
function detectFileTypeFromBuffer(buffer) {
  if (!buffer || buffer.length < 4) {
    return 'txt'; // Default fallback
  }
  
  // PDF magic number: %PDF
  if (buffer.toString('ascii', 0, 4) === '%PDF') {
    return 'pdf';
  }
  
  // DOCX magic number: PK (ZIP format)
  if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
    // Check for DOCX-specific content
    const content = buffer.toString('ascii', 0, 1000);
    if (content.includes('word/') || content.includes('xl/') || content.includes('ppt/')) {
      return 'docx';
    }
  }
  
  // HTML detection
  const textStart = buffer.toString('utf8', 0, 1000).toLowerCase();
  if (textStart.includes('<!doctype html') || 
      textStart.includes('<html') || 
      textStart.includes('<head>') ||
      textStart.includes('<body>')) {
    return 'html';
  }
  
  // CSV detection (simple heuristic)
  const firstLine = buffer.toString('utf8', 0, 500).split('\n')[0];
  if (firstLine && (firstLine.includes(',') || firstLine.includes(';') || firstLine.includes('\t'))) {
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    
    if (commaCount > 2 || semicolonCount > 2 || tabCount > 2) {
      return 'csv';
    }
  }
  
  // Default to text
  return 'txt';
}

/**
 * Generate unique chunk ID
 */
function generateChunkId(filename, chunkIndex) {
  const baseFilename = filename.replace(/\.[^/.]+$/, ''); // Remove extension
  const timestamp = Date.now();
  return `${baseFilename}_chunk_${chunkIndex}_${timestamp}`;
}

/**
 * Get supported file types
 */
export function getSupportedFileTypes() {
  return {
    'PDF': {
      extensions: ['.pdf'],
      mimeTypes: ['application/pdf'],
      description: 'Portable Document Format',
    },
    'DOCX': {
      extensions: ['.docx', '.doc'],
      mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      description: 'Microsoft Word Document',
    },
    'TXT': {
      extensions: ['.txt', '.text'],
      mimeTypes: ['text/plain'],
      description: 'Plain Text File',
    },
    'CSV': {
      extensions: ['.csv'],
      mimeTypes: ['text/csv'],
      description: 'Comma-Separated Values',
    },
    'HTML': {
      extensions: ['.html', '.htm'],
      mimeTypes: ['text/html'],
      description: 'HyperText Markup Language',
    },
  };
}

/**
 * Validate file before processing
 */
export function validateFile(buffer, filename, options = {}) {
  const {
    maxFileSize = 50 * 1024 * 1024, // 50MB default
    allowedTypes = Object.keys(getSupportedFileTypes()),
  } = options;

  const errors = [];
  const warnings = [];

  // Check file size
  if (buffer.length > maxFileSize) {
    errors.push(`File size (${Math.round(buffer.length / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(maxFileSize / 1024 / 1024)}MB)`);
  }

  // Check file type
  const fileType = detectFileType(filename, buffer);
  if (!allowedTypes.includes(fileType)) {
    errors.push(`File type "${fileType}" is not supported. Supported types: ${allowedTypes.join(', ')}`);
  }

  // Check if file appears to be empty
  if (buffer.length < 10) {
    errors.push('File appears to be empty or too small');
  }

  // Check for potential issues
  if (buffer.length > 10 * 1024 * 1024) { // 10MB
    warnings.push('Large file detected - processing may take longer');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    detectedType: fileType,
  };
}

// Export all individual extractors for direct use
export {
  extractFromPDF,
  extractFromDOCX,
  extractFromTXT,
  extractFromCSV,
  extractFromHTML,
  chunkPDFText,
  chunkDOCXText,
  chunkTXTText,
  chunkCSVText,
  chunkHTMLText,
};