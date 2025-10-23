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
      maxChunkSize: 700,
      overlap: 100,
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

    // Add universal chunk metadata
    chunks = chunks.map((chunk, index) => ({
      ...chunk,
      id: generateChunkId(extractedData.metadata?.originalFilename || 'unknown', index),
      sourceFileType: fileType,
      extractedAt: new Date().toISOString(),
    }));

    PerformanceMonitor.endTimer('universal-chunking');
    return chunks;

  } catch (error) {
    PerformanceMonitor.endTimer('universal-chunking', 'error');
    console.error('Universal chunking error:', error);
    throw new Error(`Failed to chunk text: ${error.message}`);
  }
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