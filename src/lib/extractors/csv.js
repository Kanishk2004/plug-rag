import Papa from 'papaparse';
import { PerformanceMonitor } from '../performance.js';

/**
 * Extract text from CSV files with optimization for vector embeddings
 * 
 * @param {Buffer} buffer - CSV file buffer
 * @param {Object} options - Extraction options
 * @returns {Object} Extracted text data with metadata
 */
export async function extractFromCSV(buffer, options = {}) {
  const {
    encoding = 'utf8',
    delimiter = 'auto',
    hasHeader = true,
    maxRows = 10000,
    includeStructure = true,
  } = options;

  try {
    PerformanceMonitor.startTimer('csv-extraction');

    // Convert buffer to string
    const csvText = buffer.toString(encoding);
    
    // Parse CSV with Papa Parse
    const parseConfig = {
      delimiter: delimiter === 'auto' ? '' : delimiter,
      header: hasHeader,
      skipEmptyLines: true,
      transformHeader: (header) => header?.trim(),
      transform: (value) => value?.trim(),
      preview: maxRows,
    };

    const parseResult = Papa.parse(csvText, parseConfig);
    
    if (parseResult.errors.length > 0) {
      console.warn('CSV parsing warnings:', parseResult.errors);
    }

    const data = parseResult.data;
    const headers = hasHeader ? Object.keys(data[0] || {}) : generateHeaders(data[0]?.length || 0);
    
    // Extract text in multiple formats for embedding
    const extractedText = extractTextFromCSV(data, headers, hasHeader);
    const structure = includeStructure ? analyzeCSVStructure(data, headers) : {};

    const result = {
      text: extractedText,
      structure: structure,
      data: data.slice(0, 100), // Keep first 100 rows for reference
      metadata: {
        fileType: 'csv',
        encoding: encoding,
        delimiter: parseResult.meta.delimiter,
        hasHeader: hasHeader,
        totalRows: data.length,
        totalColumns: headers.length,
        extractedAt: new Date().toISOString(),
        parseErrors: parseResult.errors,
      },
      wordCount: countWords(extractedText),
      characterCount: extractedText.length,
    };

    PerformanceMonitor.endTimer('csv-extraction');
    return result;

  } catch (error) {
    PerformanceMonitor.endTimer('csv-extraction', 'error');
    console.error('CSV extraction error:', error);
    throw new Error(`Failed to extract text from CSV: ${error.message}`);
  }
}

/**
 * Extract text from CSV data in multiple formats
 */
function extractTextFromCSV(data, headers, hasHeader) {
  if (!data || data.length === 0) {
    return '';
  }

  const textSections = [];

  // 1. Column descriptions (if headers are meaningful)
  if (hasHeader && headers.length > 0) {
    const columnDescriptions = headers
      .filter(header => header && header.length > 0)
      .map(header => `Column: ${header}`)
      .join('\n');
    
    if (columnDescriptions) {
      textSections.push(`Dataset Columns:\n${columnDescriptions}`);
    }
  }

  // 2. Row-by-row descriptions (natural language format)
  const rowDescriptions = data
    .slice(0, Math.min(data.length, 500)) // Limit to first 500 rows
    .map((row, index) => {
      if (hasHeader) {
        return createRowDescription(row, headers, index);
      } else {
        return createArrayDescription(row, index);
      }
    })
    .filter(desc => desc && desc.length > 0);

  if (rowDescriptions.length > 0) {
    textSections.push(`Dataset Records:\n${rowDescriptions.join('\n\n')}`);
  }

  // 3. Summary statistics and patterns
  const summary = generateCSVSummary(data, headers, hasHeader);
  if (summary) {
    textSections.push(`Dataset Summary:\n${summary}`);
  }

  return textSections.join('\n\n');
}

/**
 * Create natural language description for a row (object format)
 */
function createRowDescription(row, headers, index) {
  const descriptions = [];
  
  for (const header of headers) {
    const value = row[header];
    if (value !== null && value !== undefined && value !== '') {
      const cleanValue = String(value).trim();
      if (cleanValue.length > 0) {
        descriptions.push(`${header}: ${cleanValue}`);
      }
    }
  }
  
  if (descriptions.length === 0) {
    return '';
  }
  
  return `Record ${index + 1}: ${descriptions.join(', ')}.`;
}

/**
 * Create natural language description for a row (array format)
 */
function createArrayDescription(row, index) {
  if (!Array.isArray(row) || row.length === 0) {
    return '';
  }
  
  const values = row
    .map((value, colIndex) => {
      const cleanValue = String(value || '').trim();
      return cleanValue.length > 0 ? `Column ${colIndex + 1}: ${cleanValue}` : null;
    })
    .filter(desc => desc !== null);
  
  if (values.length === 0) {
    return '';
  }
  
  return `Record ${index + 1}: ${values.join(', ')}.`;
}

/**
 * Generate summary and insights about the CSV data
 */
function generateCSVSummary(data, headers, hasHeader) {
  if (!data || data.length === 0) {
    return '';
  }

  const summaryParts = [];
  
  // Basic statistics
  summaryParts.push(`This dataset contains ${data.length} records with ${headers.length} columns.`);
  
  if (hasHeader && headers.length > 0) {
    // Column analysis
    const columnAnalysis = analyzeColumns(data, headers);
    
    // Identify key columns
    const textColumns = columnAnalysis.filter(col => col.type === 'text' && col.uniqueValues > 1);
    const numericColumns = columnAnalysis.filter(col => col.type === 'numeric');
    const dateColumns = columnAnalysis.filter(col => col.type === 'date');
    
    if (textColumns.length > 0) {
      summaryParts.push(`Text columns include: ${textColumns.map(col => col.name).join(', ')}.`);
    }
    
    if (numericColumns.length > 0) {
      summaryParts.push(`Numeric columns include: ${numericColumns.map(col => col.name).join(', ')}.`);
    }
    
    if (dateColumns.length > 0) {
      summaryParts.push(`Date columns include: ${dateColumns.map(col => col.name).join(', ')}.`);
    }
    
    // Identify potential key fields
    const keyColumns = columnAnalysis.filter(col => 
      col.uniqueValues === data.length || 
      col.name.toLowerCase().includes('id') || 
      col.name.toLowerCase().includes('key')
    );
    
    if (keyColumns.length > 0) {
      summaryParts.push(`Key identifier columns: ${keyColumns.map(col => col.name).join(', ')}.`);
    }
    
    // Sample values for important text columns
    const importantTextColumns = textColumns
      .filter(col => col.uniqueValues > 5 && col.avgLength > 10)
      .slice(0, 3);
    
    for (const col of importantTextColumns) {
      const sampleValues = getSampleValues(data, col.name, 3);
      if (sampleValues.length > 0) {
        summaryParts.push(`Sample ${col.name} values: ${sampleValues.join(', ')}.`);
      }
    }
  }
  
  return summaryParts.join(' ');
}

/**
 * Analyze column types and characteristics
 */
function analyzeColumns(data, headers) {
  return headers.map(header => {
    const values = data
      .map(row => row[header])
      .filter(val => val !== null && val !== undefined && val !== '');
    
    const uniqueValues = new Set(values).size;
    const totalValues = values.length;
    
    // Determine column type
    let type = 'text';
    if (values.length > 0) {
      const numericValues = values.filter(val => !isNaN(val) && !isNaN(parseFloat(val)));
      const dateValues = values.filter(val => isValidDate(val));
      
      if (numericValues.length / values.length > 0.8) {
        type = 'numeric';
      } else if (dateValues.length / values.length > 0.5) {
        type = 'date';
      }
    }
    
    // Calculate average length for text values
    const avgLength = values.length > 0 
      ? values.reduce((sum, val) => sum + String(val).length, 0) / values.length 
      : 0;
    
    return {
      name: header,
      type: type,
      uniqueValues: uniqueValues,
      totalValues: totalValues,
      fillRate: totalValues / data.length,
      avgLength: Math.round(avgLength),
    };
  });
}

/**
 * Check if a value is a valid date
 */
function isValidDate(value) {
  if (!value) return false;
  const date = new Date(value);
  return date instanceof Date && !isNaN(date);
}

/**
 * Get sample values from a column
 */
function getSampleValues(data, columnName, count = 3) {
  const values = data
    .map(row => row[columnName])
    .filter(val => val !== null && val !== undefined && val !== '')
    .map(val => String(val).trim())
    .filter(val => val.length > 0);
  
  // Get unique values
  const uniqueValues = [...new Set(values)];
  
  // Return sample of unique values
  return uniqueValues.slice(0, count);
}

/**
 * Analyze CSV structure for better chunking
 */
function analyzeCSVStructure(data, headers) {
  const structure = {
    columns: analyzeColumns(data, headers),
    patterns: {},
    categories: {},
  };
  
  // Identify categorical columns
  for (const col of structure.columns) {
    if (col.type === 'text' && col.uniqueValues < data.length * 0.1) {
      const values = data
        .map(row => row[col.name])
        .filter(val => val !== null && val !== undefined && val !== '');
      
      structure.categories[col.name] = [...new Set(values)];
    }
  }
  
  // Identify potential grouping patterns
  const textColumns = structure.columns
    .filter(col => col.type === 'text' && col.uniqueValues > 1 && col.uniqueValues < data.length * 0.5);
  
  if (textColumns.length > 0) {
    structure.patterns.groupingColumns = textColumns.map(col => col.name);
  }
  
  return structure;
}

/**
 * Generate headers for CSV without headers
 */
function generateHeaders(columnCount) {
  return Array.from({ length: columnCount }, (_, i) => `Column_${i + 1}`);
}

/**
 * Count words in text
 */
function countWords(text) {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Chunk CSV text for vector embeddings
 * 
 * @param {string} text - Extracted text
 * @param {Object} structure - CSV structure analysis
 * @param {Array} data - Original CSV data
 * @param {Object} options - Chunking options
 * @returns {Array} Text chunks optimized for embeddings
 */
export function chunkCSVText(text, structure = {}, data = [], options = {}) {
  const {
    maxChunkSize = 700,
    overlap = 100,
    groupByCategory = true,
    includeColumnContext = true,
  } = options;

  if (!text || text.length === 0) {
    return [];
  }

  const chunks = [];
  
  // If we have structure and data, create smart chunks
  if (structure.columns && data.length > 0) {
    chunks.push(...createStructuredCSVChunks(text, structure, data, maxChunkSize, includeColumnContext));
  } else {
    // Fallback to simple text chunking
    chunks.push(...createSimpleChunks(text, maxChunkSize));
  }
  
  // Add overlap between chunks
  return addOverlapToChunks(chunks, overlap);
}

/**
 * Create structured chunks based on CSV analysis
 */
function createStructuredCSVChunks(text, structure, data, maxChunkSize, includeColumnContext) {
  const chunks = [];
  
  // 1. Column information chunk
  if (includeColumnContext && structure.columns.length > 0) {
    const columnInfo = structure.columns
      .map(col => `${col.name} (${col.type}): ${col.uniqueValues} unique values, ${Math.round(col.fillRate * 100)}% filled`)
      .join('\n');
    
    const columnChunk = `Dataset Structure:\n${columnInfo}`;
    const columnTokens = estimateTokens(columnChunk);
    
    if (columnTokens <= maxChunkSize) {
      chunks.push({
        content: columnChunk,
        tokens: columnTokens,
        type: 'column_metadata',
      });
    }
  }
  
  // 2. Category-based chunks (if categories exist)
  if (structure.categories && Object.keys(structure.categories).length > 0) {
    for (const [columnName, categories] of Object.entries(structure.categories)) {
      for (const category of categories) {
        const categoryRows = data.filter(row => row[columnName] === category);
        if (categoryRows.length > 0) {
          const categoryText = categoryRows
            .slice(0, 50) // Limit rows per category
            .map((row, index) => createRowDescription(row, structure.columns.map(c => c.name), index))
            .filter(desc => desc.length > 0)
            .join('\n');
          
          if (categoryText) {
            const categoryChunk = `Category "${category}" in ${columnName}:\n${categoryText}`;
            const categoryTokens = estimateTokens(categoryChunk);
            
            if (categoryTokens <= maxChunkSize) {
              chunks.push({
                content: categoryChunk,
                tokens: categoryTokens,
                type: 'category_group',
                category: category,
                columnName: columnName,
              });
            } else {
              // Split large category into smaller chunks
              const subChunks = createSimpleChunks(categoryChunk, maxChunkSize);
              subChunks.forEach(chunk => {
                chunk.type = 'category_group_part';
                chunk.category = category;
                chunk.columnName = columnName;
              });
              chunks.push(...subChunks);
            }
          }
        }
      }
    }
  } else {
    // 3. Sequential row chunks
    const batchSize = Math.floor(maxChunkSize / 50); // Estimate rows per chunk
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const batchText = batch
        .map((row, index) => createRowDescription(row, structure.columns.map(c => c.name), i + index))
        .filter(desc => desc.length > 0)
        .join('\n');
      
      if (batchText) {
        const batchTokens = estimateTokens(batchText);
        chunks.push({
          content: batchText,
          tokens: batchTokens,
          type: 'row_batch',
          startRow: i,
          endRow: i + batch.length - 1,
        });
      }
    }
  }
  
  return chunks;
}

/**
 * Create simple text chunks
 */
function createSimpleChunks(text, maxChunkSize) {
  const chunks = [];
  const paragraphs = text.split(/\n\s*\n/);
  
  let currentChunk = '';
  let currentTokens = 0;
  
  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);
    
    if (currentTokens + paragraphTokens > maxChunkSize && currentChunk) {
      chunks.push({
        content: currentChunk.trim(),
        tokens: currentTokens,
        type: 'text_chunk',
      });
      
      currentChunk = paragraph;
      currentTokens = paragraphTokens;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      currentTokens += paragraphTokens;
    }
  }
  
  if (currentChunk) {
    chunks.push({
      content: currentChunk.trim(),
      tokens: currentTokens,
      type: 'text_chunk',
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
    
    // Skip overlap for metadata chunks
    if (currentChunk.type === 'column_metadata' || previousChunk.type === 'column_metadata') {
      overlappedChunks.push(currentChunk);
      continue;
    }
    
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
