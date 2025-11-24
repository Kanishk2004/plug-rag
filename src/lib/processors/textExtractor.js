/**
 * Universal Text Extraction Processor
 * 
 * Handles text extraction from various file formats including
 * PDF, CSV, TXT, MD, HTML, and DOCX files.
 */

import Papa from 'papaparse';
import mammoth from 'mammoth';
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
    
    // Determine file type with fallback to extension like old implementation
    const fileType = file.type || '';
    const fileName = file.name.toLowerCase();

    if (fileType === SUPPORTED_MIME_TYPES.PDF || fileName.endsWith('.pdf')) {
      extractedText = await extractFromPDF(fileBuffer);
    } else if (fileType === SUPPORTED_MIME_TYPES.CSV || fileName.endsWith('.csv')) {
      extractedText = await extractFromCSV(fileBuffer);
    } else if (
      fileType === SUPPORTED_MIME_TYPES.TEXT ||
      fileType === SUPPORTED_MIME_TYPES.MARKDOWN ||
      fileName.endsWith('.txt') ||
      fileName.endsWith('.md')
    ) {
      extractedText = await extractFromText(fileBuffer);
    } else if (fileType === SUPPORTED_MIME_TYPES.HTML || fileName.endsWith('.html')) {
      extractedText = await extractFromHTML(fileBuffer);
    } else if (fileType === SUPPORTED_MIME_TYPES.DOCX || fileName.endsWith('.docx')) {
      extractedText = await extractFromDOCX(fileBuffer);
    } else {
      // Try to process as text if type is unknown
      extractedText = await extractFromText(fileBuffer);
      logInfo('Unknown file type, processed as text', { fileType: file.type });
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
 * Extract text from PDF using pdf2json with robust error handling
 * @param {Buffer} fileBuffer - PDF file buffer
 * @returns {Promise<string>} Extracted text
 */
async function extractFromPDF(fileBuffer) {
  logInfo('Processing PDF file');

  // Suppress pdf2json console warnings like old implementation
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    // Use dynamic import pattern from old implementation
    const PDFParser = (await import('pdf2json')).default;

    const pdfText = await new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();

      pdfParser.on('pdfParser_dataError', (errData) => {
        logError('PDF parsing error', { error: errData.parserError });
        reject(new Error(`PDF parsing failed: ${errData.parserError}`));
      });

      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        try {
          const textContent = extractTextFromPDFData(pdfData);
          resolve(textContent);
        } catch (extractError) {
          reject(new Error(`Failed to extract PDF text: ${extractError.message}`));
        }
      });

      try {
        pdfParser.parseBuffer(fileBuffer);
      } catch (bufferError) {
        reject(new Error(`Failed to parse PDF buffer: ${bufferError.message}`));
      }
    });

    logInfo('PDF extraction completed', {
      extractedLength: pdfText.length
    });

    return pdfText;
  } finally {
    // Always restore console.warn
    console.warn = originalWarn;
  }
}

/**
 * Extract text content from parsed PDF data structure (from old implementation)
 * @param {Object} pdfData - Parsed PDF data from pdf2json
 * @returns {string} Clean text content extracted from PDF pages
 */
function extractTextFromPDFData(pdfData) {
  let textContent = '';

  if (!pdfData.Pages || !Array.isArray(pdfData.Pages)) {
    throw new Error('Invalid PDF data structure - no pages found');
  }

  pdfData.Pages.forEach((page, pageIndex) => {
    if (page.Texts && Array.isArray(page.Texts)) {
      page.Texts.forEach((text) => {
        if (text.R && Array.isArray(text.R)) {
          text.R.forEach((textRun) => {
            if (textRun.T) {
              try {
                textContent += decodeURIComponent(textRun.T) + ' ';
              } catch (decodeError) {
                // Fallback to raw text if URI decoding fails
                textContent += textRun.T + ' ';
              }
            }
          });
        }
      });
    }
    textContent += '\n'; // Page break
  });

  const cleanedText = textContent.trim();
  if (cleanedText.length === 0) {
    throw new Error('No text content extracted from PDF');
  }

  return cleanedText;
}

/**
 * Extract text from CSV file using PapaParse with robust error handling
 * @param {Buffer} fileBuffer - CSV file buffer
 * @returns {Promise<string>} Formatted text representation
 */
async function extractFromCSV(fileBuffer) {
  try {
    logInfo('Processing CSV file');
    
    const csvContent = fileBuffer.toString('utf-8');
    
    // Parse CSV using Papa Parse with same config as old implementation
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parsed.errors && parsed.errors.length > 0) {
      logInfo('CSV parsing warnings', { errors: parsed.errors });
    }

    // Convert to readable format like old implementation
    const formattedContent = parsed.data
      .filter((row) =>
        Object.values(row).some((value) => value && value.toString().trim())
      )
      .map((row, index) => {
        const rowData = Object.entries(row)
          .filter(([key, value]) => value && value.toString().trim())
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        return `Row ${index + 1}: ${rowData}`;
      })
      .join('\n');

    logInfo('CSV extraction completed', {
      rows: parsed.data.length
    });

    return formattedContent;
  } catch (error) {
    logError('CSV extraction failed', { error: error.message });
    throw new Error(`Failed to extract text from CSV: ${error.message}`);
  }
}

/**
 * Extract text from plain text or markdown files (improved from old implementation)
 * @param {Buffer} fileBuffer - Text file buffer
 * @returns {Promise<string>} Raw text content
 */
async function extractFromText(fileBuffer) {
  try {
    logInfo('Processing plain text file');
    
    const text = fileBuffer.toString('utf-8');
    
    // Clean text like old implementation
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
 * Extract text from HTML file by removing tags (improved from old implementation)
 * @param {Buffer} fileBuffer - HTML file buffer
 * @returns {Promise<string>} Plain text content
 */
async function extractFromHTML(fileBuffer) {
  try {
    logInfo('Processing HTML file');
    
    const htmlContent = fileBuffer.toString('utf-8');
    
    // Strip HTML tags and normalize whitespace like old implementation
    const textContent = htmlContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')   // Remove styles
      .replace(/<[^>]*>/g, ' ')                          // Remove all HTML tags
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
 * Extract text from DOCX file using mammoth
 * @param {Buffer} fileBuffer - DOCX file buffer
 * @returns {Promise<string>} Extracted text
 */
async function extractFromDOCX(fileBuffer) {
  try {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    
    if (result.messages && result.messages.length > 0) {
      logInfo('DOCX extraction warnings', {
        warnings: result.messages.map(msg => msg.message)
      });
    }
    
    const extractedText = result.value.trim();
    
    if (extractedText.length === 0) {
      throw new Error('No text content could be extracted from DOCX file');
    }
    
    logInfo('DOCX extraction completed', {
      extractedLength: extractedText.length,
      wordsExtracted: extractedText.split(/\s+/).length
    });
    
    return extractedText;
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
