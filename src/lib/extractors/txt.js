import { PerformanceMonitor } from '../performance.js';

/**
 * Extract text from TXT files with optimization for vector embeddings
 * 
 * @param {Buffer} buffer - TXT file buffer
 * @param {Object} options - Extraction options
 * @returns {Object} Extracted text data with metadata
 */
export async function extractFromTXT(buffer, options = {}) {
  const {
    encoding = 'utf8',
    preserveFormatting = false,
    detectStructure = true,
  } = options;

  try {
    PerformanceMonitor.startTimer('txt-extraction');

    // Convert buffer to string with specified encoding
    let text = buffer.toString(encoding);
    
    // Detect encoding if extraction fails or produces garbled text
    if (isGarbledText(text)) {
      text = tryAlternativeEncodings(buffer);
    }
    
    // Clean and optimize text for embeddings
    if (!preserveFormatting) {
      text = cleanTXTText(text);
    }

    // Detect document structure
    const structure = detectStructure ? detectTextStructure(text) : {};

    const result = {
      text: text,
      structure: structure,
      metadata: {
        fileType: 'txt',
        encoding: encoding,
        extractedAt: new Date().toISOString(),
        detectedEncoding: detectEncoding(buffer),
      },
      wordCount: countWords(text),
      characterCount: text.length,
      lineCount: text.split('\n').length,
    };

    PerformanceMonitor.endTimer('txt-extraction');
    return result;

  } catch (error) {
    PerformanceMonitor.endTimer('txt-extraction', 'error');
    console.error('TXT extraction error:', error);
    throw new Error(`Failed to extract text from TXT: ${error.message}`);
  }
}

/**
 * Clean TXT text for better vector embedding quality
 */
function cleanTXTText(text) {
  return text
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    
    // Remove excessive whitespace
    .replace(/\n{4,}/g, '\n\n\n') // Max 3 consecutive newlines
    .replace(/[ \t]{2,}/g, ' ') // Multiple spaces to single space
    .replace(/^\s+$/gm, '') // Remove lines with only whitespace
    
    // Clean up common artifacts
    .replace(/={3,}/g, '===') // Normalize separators
    .replace(/-{3,}/g, '---') // Normalize dashes
    .replace(/\*{3,}/g, '***') // Normalize asterisks
    
    // Fix spacing around punctuation
    .replace(/\s+([.!?,:;])/g, '$1')
    .replace(/([.!?])\s+/g, '$1 ')
    
    // Clean up email artifacts
    .replace(/^>+\s*/gm, '') // Remove email quote markers
    .replace(/^\s*On.*wrote:\s*$/gm, '') // Remove email headers
    
    // Clean up common list formats
    .replace(/^[\s]*[-*+]\s+/gm, '• ') // Normalize bullet points
    .replace(/^[\s]*\d+[\.)]\s+/gm, (match) => {
      const num = match.match(/\d+/)[0];
      return `${num}. `;
    })
    
    // Remove excessive spacing but preserve paragraph breaks
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    
    .trim();
}

/**
 * Detect if text is garbled (wrong encoding)
 */
function isGarbledText(text) {
  // Check for common garbled text patterns
  const garbledPatterns = [
    /Ã¡|Ã©|Ã­|Ã³|Ãº/, // Common UTF-8 interpreted as Latin-1
    /â€™|â€œ|â€/, // Smart quotes garbled
    /Â[^\s]/, // Non-breaking space artifacts
    /\uFFFD/, // Replacement character
  ];
  
  return garbledPatterns.some(pattern => pattern.test(text));
}

/**
 * Try alternative encodings if initial extraction fails
 */
function tryAlternativeEncodings(buffer) {
  const encodings = ['utf8', 'latin1', 'ascii', 'utf16le'];
  
  for (const encoding of encodings) {
    try {
      const text = buffer.toString(encoding);
      if (!isGarbledText(text)) {
        console.log(`Successfully decoded with ${encoding} encoding`);
        return text;
      }
    } catch (error) {
      continue;
    }
  }
  
  // Fallback to utf8 with replacement characters
  console.warn('Could not detect proper encoding, using UTF-8 with replacements');
  return buffer.toString('utf8');
}

/**
 * Detect text encoding
 */
function detectEncoding(buffer) {
  // Simple encoding detection based on BOM
  if (buffer.length >= 3 && 
      buffer[0] === 0xEF && 
      buffer[1] === 0xBB && 
      buffer[2] === 0xBF) {
    return 'utf8-bom';
  }
  
  if (buffer.length >= 2 && 
      buffer[0] === 0xFF && 
      buffer[1] === 0xFE) {
    return 'utf16le';
  }
  
  if (buffer.length >= 2 && 
      buffer[0] === 0xFE && 
      buffer[1] === 0xFF) {
    return 'utf16be';
  }
  
  // Check for high-bit characters (likely UTF-8 or Latin-1)
  let hasHighBit = false;
  for (let i = 0; i < Math.min(buffer.length, 1000); i++) {
    if (buffer[i] > 127) {
      hasHighBit = true;
      break;
    }
  }
  
  return hasHighBit ? 'utf8' : 'ascii';
}

/**
 * Detect document structure in plain text
 */
function detectTextStructure(text) {
  const lines = text.split('\n');
  const structure = {
    headings: [],
    sections: [],
    lists: [],
    codeBlocks: [],
    tables: [],
  };

  let currentSection = null;
  let inCodeBlock = false;
  let codeBlockStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
    
    if (!line) continue;

    // Detect code blocks
    if (line.startsWith('```') || line.startsWith('~~~')) {
      if (inCodeBlock) {
        structure.codeBlocks.push({
          startLine: codeBlockStart,
          endLine: i,
          language: lines[codeBlockStart].substring(3).trim(),
        });
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBlockStart = i;
      }
      continue;
    }

    if (inCodeBlock) continue;

    // Detect headings (various formats)
    if (isHeading(line, nextLine)) {
      const level = getHeadingLevel(line, nextLine);
      structure.headings.push({
        text: cleanHeading(line),
        level: level,
        lineNumber: i,
      });
      
      if (currentSection) {
        currentSection.endLine = i - 1;
      }
      
      currentSection = {
        heading: cleanHeading(line),
        startLine: i,
        endLine: lines.length - 1,
      };
      structure.sections.push(currentSection);
      continue;
    }

    // Detect lists
    if (isListItem(line)) {
      const existingList = structure.lists[structure.lists.length - 1];
      if (existingList && existingList.endLine === i - 1) {
        existingList.endLine = i;
        existingList.items.push(cleanListItem(line));
      } else {
        structure.lists.push({
          startLine: i,
          endLine: i,
          type: getListType(line),
          items: [cleanListItem(line)],
        });
      }
      continue;
    }

    // Detect tables (simple pipe-separated)
    if (isTableRow(line)) {
      const existingTable = structure.tables[structure.tables.length - 1];
      if (existingTable && existingTable.endLine === i - 1) {
        existingTable.endLine = i;
        existingTable.rows.push(parseTableRow(line));
      } else {
        structure.tables.push({
          startLine: i,
          endLine: i,
          rows: [parseTableRow(line)],
        });
      }
    }
  }

  return structure;
}

/**
 * Check if line is a heading
 */
function isHeading(line, nextLine) {
  // Markdown-style headers
  if (line.match(/^#{1,6}\s+/)) return true;
  
  // Underlined headers
  if (nextLine && (nextLine.match(/^=+$/) || nextLine.match(/^-+$/))) return true;
  
  // ALL CAPS headers (if short enough)
  if (line.length < 60 && line === line.toUpperCase() && line.match(/[A-Z]/)) return true;
  
  // Numbered sections
  if (line.match(/^\d+(\.\d+)*\.?\s+[A-Z]/)) return true;
  
  return false;
}

/**
 * Get heading level
 */
function getHeadingLevel(line, nextLine) {
  const hashMatch = line.match(/^(#{1,6})\s+/);
  if (hashMatch) return hashMatch[1].length;
  
  if (nextLine?.match(/^=+$/)) return 1;
  if (nextLine?.match(/^-+$/)) return 2;
  
  if (line.match(/^\d+\.\s+/)) return 1;
  if (line.match(/^\d+\.\d+\.\s+/)) return 2;
  if (line.match(/^\d+\.\d+\.\d+\.\s+/)) return 3;
  
  return 1;
}

/**
 * Clean heading text
 */
function cleanHeading(line) {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/\s+#{1,6}$/, '')
    .replace(/^\d+(\.\d+)*\.?\s+/, '')
    .trim();
}

/**
 * Check if line is a list item
 */
function isListItem(line) {
  return line.match(/^[\s]*[-*+•]\s+/) || line.match(/^[\s]*\d+[\.)]\s+/);
}

/**
 * Get list type
 */
function getListType(line) {
  return line.match(/^[\s]*\d+[\.)]\s+/) ? 'ordered' : 'unordered';
}

/**
 * Clean list item text
 */
function cleanListItem(line) {
  return line.replace(/^[\s]*[-*+•]\s+/, '').replace(/^[\s]*\d+[\.)]\s+/, '').trim();
}

/**
 * Check if line is a table row
 */
function isTableRow(line) {
  return line.includes('|') && line.split('|').length >= 3;
}

/**
 * Parse table row
 */
function parseTableRow(line) {
  return line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
}

/**
 * Count words in text
 */
function countWords(text) {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Chunk TXT text for vector embeddings with structure awareness
 * 
 * @param {string} text - Extracted text
 * @param {Object} structure - Detected structure
 * @param {Object} options - Chunking options
 * @returns {Array} Text chunks optimized for embeddings
 */
export function chunkTXTText(text, structure = {}, options = {}) {
  const {
    maxChunkSize = 700,
    overlap = 100,
    respectStructure = true,
  } = options;

  if (!text || text.length === 0) {
    return [];
  }

  const chunks = [];
  
  if (respectStructure && structure.sections?.length > 0) {
    // Structure-aware chunking using sections
    chunks.push(...createStructuredChunks(text, structure, maxChunkSize));
  } else {
    // Fallback to paragraph-based chunking
    chunks.push(...createParagraphChunks(text, maxChunkSize));
  }
  
  // Add overlap between chunks
  return addOverlapToChunks(chunks, overlap);
}

/**
 * Create chunks based on detected structure
 */
function createStructuredChunks(text, structure, maxChunkSize) {
  const chunks = [];
  const lines = text.split('\n');
  
  for (const section of structure.sections) {
    const sectionLines = lines.slice(section.startLine, section.endLine + 1);
    const sectionText = sectionLines.join('\n');
    const sectionTokens = estimateTokens(sectionText);
    
    if (sectionTokens <= maxChunkSize) {
      // Section fits in one chunk
      chunks.push({
        content: sectionText.trim(),
        tokens: sectionTokens,
        type: 'section',
        heading: section.heading,
      });
    } else {
      // Split section into smaller chunks
      const sectionChunks = createParagraphChunks(sectionText, maxChunkSize);
      sectionChunks.forEach(chunk => {
        chunk.heading = section.heading;
        chunk.type = 'section_part';
      });
      chunks.push(...sectionChunks);
    }
  }
  
  return chunks;
}

/**
 * Create chunks based on paragraphs
 */
function createParagraphChunks(text, maxChunkSize) {
  const chunks = [];
  const paragraphs = text.split(/\n\s*\n/);
  
  let currentChunk = '';
  let currentTokens = 0;
  
  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);
    
    if (paragraphTokens > maxChunkSize) {
      // Save current chunk if exists
      if (currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          tokens: currentTokens,
          type: 'paragraph_boundary',
        });
        currentChunk = '';
        currentTokens = 0;
      }
      
      // Split long paragraph by sentences
      const sentences = paragraph.split(/[.!?]+\s+/);
      let sentenceChunk = '';
      let sentenceTokens = 0;
      
      for (const sentence of sentences) {
        const sentTokens = estimateTokens(sentence);
        
        if (sentenceTokens + sentTokens > maxChunkSize && sentenceChunk) {
          chunks.push({
            content: sentenceChunk.trim(),
            tokens: sentenceTokens,
            type: 'sentence_boundary',
          });
          sentenceChunk = sentence;
          sentenceTokens = sentTokens;
        } else {
          sentenceChunk += (sentenceChunk ? '. ' : '') + sentence;
          sentenceTokens += sentTokens;
        }
      }
      
      if (sentenceChunk) {
        chunks.push({
          content: sentenceChunk.trim(),
          tokens: sentenceTokens,
          type: 'sentence_boundary',
        });
      }
      
    } else if (currentTokens + paragraphTokens > maxChunkSize) {
      // Current chunk is full
      chunks.push({
        content: currentChunk.trim(),
        tokens: currentTokens,
        type: 'paragraph_boundary',
      });
      
      currentChunk = paragraph;
      currentTokens = paragraphTokens;
      
    } else {
      // Add paragraph to current chunk
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      currentTokens += paragraphTokens;
    }
  }
  
  // Add final chunk
  if (currentChunk) {
    chunks.push({
      content: currentChunk.trim(),
      tokens: currentTokens,
      type: 'paragraph_boundary',
    });
  }
  
  return chunks;
}

/**
 * Estimate token count
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Add overlap between chunks
 */
function addOverlapToChunks(chunks, overlapTokens) {
  if (chunks.length <= 1 || overlapTokens <= 0) {
    return chunks;
  }
  
  const overlappedChunks = [chunks[0]];
  
  for (let i = 1; i < chunks.length; i++) {
    const currentChunk = chunks[i];
    const previousChunk = chunks[i - 1];
    
    const previousWords = previousChunk.content.split(/\s+/);
    const overlapWordCount = Math.min(
      Math.floor(overlapTokens / 4), 
      Math.floor(previousWords.length / 2)
    );
    
    if (overlapWordCount > 0) {
      const overlapText = previousWords
        .slice(-overlapWordCount)
        .join(' ');
      
      overlappedChunks.push({
        ...currentChunk,
        content: overlapText + ' ' + currentChunk.content,
        tokens: currentChunk.tokens + estimateTokens(overlapText),
        hasOverlap: true,
      });
    } else {
      overlappedChunks.push(currentChunk);
    }
  }
  
  return overlappedChunks.map((chunk, index) => ({
    ...chunk,
    chunkIndex: index,
  }));
}
