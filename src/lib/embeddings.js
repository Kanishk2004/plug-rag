import OpenAI from 'openai';

// Initialize OpenAI client
let openaiClient = null;

/**
 * Get or create OpenAI client instance
 */
function getOpenAIClient() {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

/**
 * Generate embeddings for a single text
 */
export async function generateEmbedding(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a non-empty string');
  }
  
  const client = getOpenAIClient();
  
  try {
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.trim(),
    });
    
    if (!response.data || !response.data[0]?.embedding) {
      throw new Error('Invalid response from OpenAI embeddings API');
    }
    
    return {
      success: true,
      embedding: response.data[0].embedding,
      model: 'text-embedding-3-small',
      dimensions: response.data[0].embedding.length,
      usage: response.usage,
    };
    
  } catch (error) {
    console.error('Error generating embedding:', error);
    
    // Handle specific OpenAI errors
    if (error.status === 401) {
      throw new Error('Invalid OpenAI API key');
    } else if (error.status === 429) {
      throw new Error('OpenAI API rate limit exceeded');
    } else if (error.status >= 500) {
      throw new Error('OpenAI service temporarily unavailable');
    }
    
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

/**
 * Generate embeddings for multiple texts (batch processing)
 */
export async function generateEmbeddings(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('Texts must be a non-empty array');
  }
  
  // Validate all texts
  for (let i = 0; i < texts.length; i++) {
    if (!texts[i] || typeof texts[i] !== 'string') {
      throw new Error(`Text at index ${i} must be a non-empty string`);
    }
  }
  
  const client = getOpenAIClient();
  
  try {
    // OpenAI allows up to 2048 inputs per request for text-embedding-3-small
    const batchSize = 100; // Conservative batch size for MVP
    const results = [];
    let totalUsage = { prompt_tokens: 0, total_tokens: 0 };
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize).map(text => text.trim());
      
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
      });
      
      if (!response.data || response.data.length !== batch.length) {
        throw new Error('Invalid response from OpenAI embeddings API');
      }
      
      // Add embeddings to results
      response.data.forEach((item, index) => {
        results.push({
          index: i + index,
          embedding: item.embedding,
          text: batch[index],
        });
      });
      
      // Accumulate usage
      if (response.usage) {
        totalUsage.prompt_tokens += response.usage.prompt_tokens || 0;
        totalUsage.total_tokens += response.usage.total_tokens || 0;
      }
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return {
      success: true,
      embeddings: results,
      model: 'text-embedding-3-small',
      dimensions: results[0]?.embedding?.length || 0,
      totalCount: results.length,
      usage: totalUsage,
    };
    
  } catch (error) {
    console.error('Error generating embeddings:', error);
    
    // Handle specific OpenAI errors
    if (error.status === 401) {
      throw new Error('Invalid OpenAI API key');
    } else if (error.status === 429) {
      throw new Error('OpenAI API rate limit exceeded');
    } else if (error.status >= 500) {
      throw new Error('OpenAI service temporarily unavailable');
    }
    
    throw new Error(`Failed to generate embeddings: ${error.message}`);
  }
}

/**
 * Generate embeddings for chunks and prepare for vector storage
 */
export async function generateChunkEmbeddings(chunks, fileId, fileName) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error('Chunks must be a non-empty array');
  }
  
  try {
    // Extract text content from chunks
    const texts = chunks.map(chunk => chunk.content);
    console.log(`Generating embeddings for ${texts.length} chunks`);
    
    // Generate embeddings
    const embeddingResult = await generateEmbeddings(texts);
    console.log(`Generated embeddings with dimensions: ${embeddingResult.dimensions}`);
    
    // Validate embeddings
    if (!embeddingResult.embeddings || embeddingResult.embeddings.length === 0) {
      throw new Error('No embeddings generated');
    }
    
    // Combine embeddings with chunk metadata
    const vectorData = embeddingResult.embeddings.map((embeddingItem, index) => {
      const chunk = chunks[index];
      
      if (!embeddingItem.embedding || !Array.isArray(embeddingItem.embedding)) {
        throw new Error(`Invalid embedding for chunk ${index}`);
      }
      
      return {
        id: chunk.id,
        embedding: embeddingItem.embedding,
        content: chunk.content,
        fileId,
        fileName,
        chunkId: chunk.id,
        chunkIndex: chunk.chunkIndex || index,
        tokens: chunk.tokens,
        chunkType: chunk.type,
        metadata: {
          characterCount: chunk.content.length,
          wordCount: chunk.content.split(/\s+/).length,
          extractedAt: new Date().toISOString(),
        },
      };
    });
    
    console.log(`Created ${vectorData.length} vector objects for storage`);
    
    return {
      success: true,
      vectors: vectorData,
      totalCount: vectorData.length,
      usage: embeddingResult.usage,
      model: embeddingResult.model,
      dimensions: embeddingResult.dimensions,
    };
    
  } catch (error) {
    console.error('Error generating chunk embeddings:', error);
    throw new Error(`Failed to generate chunk embeddings: ${error.message}`);
  }
}

/**
 * Test OpenAI connection and API key
 */
export async function testConnection() {
  try {
    const result = await generateEmbedding('Hello, world!');
    return {
      success: true,
      status: 'connected',
      model: result.model,
      dimensions: result.dimensions,
      testUsage: result.usage,
    };
    
  } catch (error) {
    console.error('OpenAI connection test failed:', error);
    return {
      success: false,
      status: 'disconnected',
      error: error.message,
    };
  }
}

const embeddingsAPI = {
  generateEmbedding,
  generateEmbeddings,
  generateChunkEmbeddings,
  testConnection,
};

export default embeddingsAPI;