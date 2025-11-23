/**
 * Universal Text Extraction Processor
 * 
 * Handles text extraction from various file formats including
 * PDF, CSV, TXT, MD, HTML, and DOCX files.
 */

import Papa from 'papaparse';
import { logInfo, logError } from '../utils/logger.js';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit

const SUPPORTED_MIME_TYPES = {
	PDF: 'application/pdf',
	CSV: 'text/csv',
	TEXT: 'text/plain',
	MARKDOWN: 'text/markdown',
	HTML: 'text/html',
	DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/**
 * Extract text content from file buffer based on file type
 * @param {File} file - File object with name and type
 * @param {Buffer} fileBuffer - File content as buffer
 * @returns {Promise<string>} Extracted text content
 */
export async function extractText(file, fileBuffer) {
  if (!file || !fileBuffer) {
    throw new Error('File and fileBuffer are required parameters');
  }

  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error(
      `File size (${fileBuffer.length} bytes) exceeds maximum limit of ${MAX_FILE_SIZE} bytes`
    );
  }

  logInfo('Starting text extraction', {
    fileName: file.name,
    fileType: file.type,
    fileSize: `${(fileBuffer.length / 1024).toFixed(2)} KB`
  });

  try {
    let extractedText = '';

    switch (file.type) {
      case SUPPORTED_MIME_TYPES.PDF:
        extractedText = await extractFromPDF(fileBuffer);
        break;

      case SUPPORTED_MIME_TYPES.CSV:
        extractedText = await extractFromCSV(fileBuffer);
        break;

      case SUPPORTED_MIME_TYPES.TEXT:
      case SUPPORTED_MIME_TYPES.MARKDOWN:
        extractedText = await extractFromText(fileBuffer);
        break;

      case SUPPORTED_MIME_TYPES.HTML:
        extractedText = await extractFromHTML(fileBuffer);
        break;

      case SUPPORTED_MIME_TYPES.DOCX:
        extractedText = await extractFromDOCX(fileBuffer);
        break;

      default:
        // Try to process as text if type is unknown
        extractedText = await extractFromText(fileBuffer);
        logInfo('Unknown file type, processed as text', { fileType: file.type });
        break;
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No text content could be extracted from the file');
    }

    logInfo('Text extraction completed', {
      fileName: file.name,
      extractedLength: extractedText.length,
      wordsExtracted: extractedText.split(/\s+/).length
    });

    return extractedText;
  } catch (error) {
    logError('Text extraction failed', {
      fileName: file.name,
      fileType: file.type,
      error: error.message
    });
    throw error;
  }
}

/**
 * Extract text from PDF using a simple PDF reader
 * Note: This is a placeholder - you'll need to implement actual PDF extraction
 * @param {Buffer} fileBuffer - PDF file buffer
 * @returns {Promise<string>} Extracted text
 */
async function extractFromPDF(fileBuffer) {
  try {
    // Placeholder implementation - you'll need to add actual PDF parsing
    // Consider using libraries like pdf-parse, pdf2pic, or pdfjs-dist
    throw new Error('PDF extraction not yet implemented. Please use a PDF parsing library like pdf-parse.');
  } catch (error) {
    logError('PDF extraction failed', { error: error.message });
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Extract text from CSV file
 * @param {Buffer} fileBuffer - CSV file buffer
 * @returns {Promise<string>} Formatted text representation
 */
async function extractFromCSV(fileBuffer) {
  try {
    const csvContent = fileBuffer.toString('utf-8');
    
    // Parse CSV using Papa Parse
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parsed.errors && parsed.errors.length > 0) {
      logError('CSV parsing warnings', { errors: parsed.errors });
    }

    // Convert CSV data to formatted text
    const headers = Object.keys(parsed.data[0] || {});
    let formattedText = `CSV Data with columns: ${headers.join(', ')}\n\n`;

    parsed.data.forEach((row, index) => {
      formattedText += `Row ${index + 1}:\n`;
      headers.forEach(header => {
        const value = row[header] || '';
        formattedText += `  ${header}: ${value}\n`;
      });
      formattedText += '\n';
    });

    logInfo('CSV extraction completed', {
      rows: parsed.data.length,
      columns: headers.length
    });

    return formattedText;
  } catch (error) {
    logError('CSV extraction failed', { error: error.message });
    throw new Error(`Failed to extract text from CSV: ${error.message}`);
  }
}

/**
 * Extract text from plain text or markdown files
 * @param {Buffer} fileBuffer - Text file buffer
 * @returns {Promise<string>} Raw text content
 */
async function extractFromText(fileBuffer) {
  try {
    const text = fileBuffer.toString('utf-8');
    
    // Basic text cleanup
    const cleanedText = text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n')   // Handle old Mac line endings
      .trim();

    if (cleanedText.length === 0) {
      throw new Error('File appears to be empty');
    }

    logInfo('Text extraction completed', {
      characters: cleanedText.length,
      lines: cleanedText.split('\n').length
    });

    return cleanedText;
  } catch (error) {
    logError('Text extraction failed', { error: error.message });
    throw new Error(`Failed to extract text: ${error.message}`);
  }
}

/**
 * Extract text from HTML file by removing tags
 * @param {Buffer} fileBuffer - HTML file buffer
 * @returns {Promise<string>} Plain text content
 */
async function extractFromHTML(fileBuffer) {
  try {
    const htmlContent = fileBuffer.toString('utf-8');
    
    // Basic HTML tag removal (simple regex approach)
    // For production, consider using a proper HTML parser like cheerio
    let textContent = htmlContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')   // Remove styles
      .replace(/<[^>]+>/g, ' ')                          // Remove all HTML tags
      .replace(/&nbsp;/g, ' ')                           // Replace non-breaking spaces
      .replace(/&amp;/g, '&')                            // Replace HTML entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')                              // Normalize whitespace
      .trim();

    if (textContent.length === 0) {
      throw new Error('No text content found in HTML file');
    }

    logInfo('HTML extraction completed', {
      originalLength: htmlContent.length,
      extractedLength: textContent.length
    });

    return textContent;
  } catch (error) {
    logError('HTML extraction failed', { error: error.message });
    throw new Error(`Failed to extract text from HTML: ${error.message}`);
  }
}

/**
 * Extract text from DOCX file
 * Note: This is a placeholder - you'll need to implement actual DOCX extraction
 * @param {Buffer} fileBuffer - DOCX file buffer
 * @returns {Promise<string>} Extracted text
 */
async function extractFromDOCX(fileBuffer) {
  try {
    // Placeholder implementation - you'll need to add actual DOCX parsing
    // Consider using libraries like mammoth, docx-parser, or officegen
    throw new Error('DOCX extraction not yet implemented. Please use a DOCX parsing library like mammoth.');
  } catch (error) {
    logError('DOCX extraction failed', { error: error.message });
    throw new Error(`Failed to extract text from DOCX: ${error.message}`);
  }
}

/**
 * Get supported MIME types
 * @returns {Object} Supported MIME types
 */
export function getSupportedMimeTypes() {
  return { ...SUPPORTED_MIME_TYPES };
}

/**
 * Check if file type is supported
 * @param {string} mimeType - MIME type to check
 * @returns {boolean} Whether the MIME type is supported
 */
export function isSupportedFileType(mimeType) {
  return Object.values(SUPPORTED_MIME_TYPES).includes(mimeType);
}

/**
 * Get file type category from MIME type
 * @param {string} mimeType - MIME type
 * @returns {string} File type category
 */
export function getFileTypeCategory(mimeType) {
  switch (mimeType) {
    case SUPPORTED_MIME_TYPES.PDF:
      return 'pdf';
    case SUPPORTED_MIME_TYPES.CSV:
      return 'csv';
    case SUPPORTED_MIME_TYPES.TEXT:
    case SUPPORTED_MIME_TYPES.MARKDOWN:
      return 'text';
    case SUPPORTED_MIME_TYPES.HTML:
      return 'html';
    case SUPPORTED_MIME_TYPES.DOCX:
      return 'docx';
    default:
      return 'unknown';
  }
}
