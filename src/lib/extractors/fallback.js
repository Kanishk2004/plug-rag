import { PerformanceMonitor } from '../performance.js';

/**
 * Universal fallback extractor - handles any file as text
 * This is a safety net when other extractors fail
 */
export async function extractFallback(buffer, filename, options = {}) {
  try {
    PerformanceMonitor.startTimer('fallback-extraction');
    
    // Try different text encodings
    let text = '';
    
    // Try UTF-8 first
    try {
      text = buffer.toString('utf8');
    } catch (e) {
      // Fallback to latin1
      try {
        text = buffer.toString('latin1');
      } catch (e2) {
        // Last resort - extract only printable ASCII
        text = buffer.toString('binary')
          .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }
    
    // Clean up the text
    text = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
    
    // If no meaningful text found, provide a placeholder
    if (text.length < 20) {
      text = `File "${filename}" was processed but readable text could not be extracted. This may be a binary file, image, or encrypted document.`;
    }
    
    const result = {
      text: text,
      pages: [{
        pageNumber: 1,
        content: text,
        wordCount: countWords(text),
      }],
      metadata: {
        originalFilename: filename,
        totalPages: 1,
        fileType: 'unknown',
        extractedAt: new Date().toISOString(),
        extractionMethod: 'fallback',
      },
      wordCount: countWords(text),
      characterCount: text.length,
    };
    
    PerformanceMonitor.endTimer('fallback-extraction');
    return result;
    
  } catch (error) {
    PerformanceMonitor.endTimer('fallback-extraction', 'error');
    throw new Error(`Fallback extraction failed: ${error.message}`);
  }
}

/**
 * Count words in text
 */
function countWords(text) {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}