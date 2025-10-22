# Vector Storage Integration Documentation

This document explains how to use the new vector storage capabilities in your RAG chatbot system.

## 🏗️ Architecture Overview

The vector storage system integrates three main components:

1. **Qdrant Vector Database**: Stores embeddings with metadata
2. **OpenAI Embeddings**: Converts text to vectors using `text-embedding-3-small`
3. **MongoDB**: Manages file metadata and processing status

### Collection Strategy
- Each bot gets its own isolated collection: `{userId}_{botId}`
- Collections are created/deleted automatically with bot lifecycle
- No cross-bot data access (complete isolation)

## 🚀 Getting Started

### 1. Environment Setup

Add these environment variables to your `.env.local`:

```bash
# Vector Database Configuration
QDRANT_URL=http://localhost:6333

# OpenAI Configuration (Required for embeddings)
OPENAI_API_KEY=your_openai_api_key_here
```

### 2. Start Qdrant with Docker

Your Docker Compose is already configured. Start it:

```bash
docker-compose up -d
```

Verify Qdrant is running:
```bash
curl http://localhost:6333/collections
```

## 📖 API Endpoints

### Vector Management

#### Health Check
```http
GET /api/vectors/health
```

**Response:**
```json
{
  "success": true,
  "qdrant": {
    "status": "connected",
    "url": "http://localhost:6333",
    "collectionsCount": 5
  },
  "openai": {
    "status": "connected",
    "model": "text-embedding-3-small",
    "dimensions": 1536
  },
  "overall": "healthy"
}
```

#### Initialize Bot Vector Storage
```http
POST /api/vectors/{botId}
```

**Response:**
```json
{
  "success": true,
  "collectionName": "user123_bot456",
  "existed": false
}
```

#### Get Bot Vector Statistics
```http
GET /api/vectors/{botId}
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "qdrant": {
      "vectorsCount": 150,
      "pointsCount": 150,
      "status": "green"
    },
    "mongodb": {
      "filesWithEmbeddings": 3,
      "chunksWithEmbeddings": 150
    },
    "bot": {
      "totalEmbeddings": 150,
      "totalTokensUsed": 25000
    }
  }
}
```

#### Search Similar Content
```http
POST /api/vectors/search
```

**Request Body:**
```json
{
  "botId": "64a7b8c9d0e1f2g3h4i5j6k7",
  "query": "How do I configure authentication?",
  "limit": 5,
  "scoreThreshold": 0.7,
  "filter": {
    "fileName": "setup-guide.pdf"
  }
}
```

**Response:**
```json
{
  "success": true,
  "query": "How do I configure authentication?",
  "results": [
    {
      "id": "chunk_123",
      "score": 0.89,
      "content": "Authentication can be configured by setting up...",
      "metadata": {
        "fileId": "64a7b8c9d0e1f2g3h4i5j6k8",
        "fileName": "setup-guide.pdf",
        "chunkIndex": 5,
        "chunkType": "paragraph_boundary"
      }
    }
  ],
  "totalFound": 5,
  "tokensUsed": 7
}
```

### File Processing with Vectors

#### Process File to Vectors
```http
POST /api/vectors/process/{fileId}
```

**Response:**
```json
{
  "success": true,
  "fileId": "64a7b8c9d0e1f2g3h4i5j6k8",
  "fileName": "document.pdf",
  "vectorsStored": 25,
  "tokensUsed": 3500,
  "collectionName": "user123_bot456"
}
```

#### Upload File with Immediate Embedding
```http
POST /api/files
```

**Form Data:**
```
file: [File object]
botId: "64a7b8c9d0e1f2g3h4i5j6k7"
options: {"generateEmbeddings": true}
```

**Response includes vector processing:**
```json
{
  "success": true,
  "file": {
    "id": "64a7b8c9d0e1f2g3h4i5j6k8",
    "embeddingStatus": "completed",
    "vectorCount": 25
  },
  "extraction": {
    "chunks": [...]
  },
  "vectorProcessing": {
    "success": true,
    "vectorsStored": 25,
    "tokensUsed": 3500,
    "collectionName": "user123_bot456"
  }
}
```

## 💻 JavaScript Client Usage

### Basic Search Implementation

```javascript
// Search for relevant content
async function searchContent(botId, userQuery) {
  try {
    const response = await fetch('/api/vectors/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        botId,
        query: userQuery,
        limit: 5,
        scoreThreshold: 0.7,
      }),
    });
    
    const result = await response.json();
    
    if (result.success) {
      return result.results;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

// Example usage
const relevantContent = await searchContent(
  'bot123', 
  'How do I set up authentication?'
);

console.log(`Found ${relevantContent.length} relevant chunks`);
relevantContent.forEach(chunk => {
  console.log(`Score: ${chunk.score}`);
  console.log(`Content: ${chunk.content.substring(0, 100)}...`);
  console.log(`Source: ${chunk.metadata.fileName}`);
});
```

### Upload with Automatic Embedding

```javascript
async function uploadFileWithEmbeddings(file, botId) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('botId', botId);
  formData.append('options', JSON.stringify({
    generateEmbeddings: true,
    maxChunkSize: 700,
    overlap: 100,
  }));
  
  try {
    const response = await fetch('/api/files', {
      method: 'POST',
      body: formData,
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('File processed:', result.file.originalName);
      console.log('Chunks created:', result.extraction.chunks.length);
      
      if (result.vectorProcessing?.success) {
        console.log('Vectors stored:', result.vectorProcessing.vectorsStored);
        console.log('Tokens used:', result.vectorProcessing.tokensUsed);
      }
      
      return result;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}
```

### React Hook for Vector Search

```jsx
import { useState, useCallback } from 'react';

export function useVectorSearch(botId) {
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  
  const search = useCallback(async (query, options = {}) => {
    setIsSearching(true);
    setError(null);
    
    try {
      const response = await fetch('/api/vectors/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          botId,
          query,
          ...options,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setResults(result.results);
        return result.results;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      setError(error.message);
      setResults([]);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [botId]);
  
  return {
    search,
    isSearching,
    results,
    error,
  };
}

// Usage in component
function ChatInterface({ botId }) {
  const { search, isSearching, results } = useVectorSearch(botId);
  
  const handleUserMessage = async (message) => {
    const relevantChunks = await search(message, {
      limit: 3,
      scoreThreshold: 0.75,
    });
    
    // Use relevant chunks to generate context for LLM
    const context = relevantChunks
      .map(chunk => chunk.content)
      .join('\n\n');
    
    // Send to your LLM with context...
  };
  
  return (
    <div>
      {/* Your chat interface */}
      {isSearching && <div>Searching knowledge base...</div>}
    </div>
  );
}
```

## 🔧 Bot Lifecycle Integration

The vector storage is automatically integrated with bot lifecycle:

### Creating a Bot
```javascript
// After creating a bot, initialize vector storage
const bot = await Bot.create({
  ownerId: userId,
  name: 'My Assistant',
  // ... other fields
});

// Initialize vector storage
await fetch(`/api/vectors/${bot._id}`, {
  method: 'POST'
});
```

### Deleting a Bot
```javascript
// Clean up vector storage before deleting bot
await fetch(`/api/vectors/${botId}`, {
  method: 'DELETE'
});

// Then delete the bot from MongoDB
await Bot.findByIdAndDelete(botId);
```

## 📊 Monitoring and Analytics

### Check System Health
```javascript
async function checkVectorHealth() {
  const response = await fetch('/api/vectors/health');
  const health = await response.json();
  
  console.log('Vector system status:', health.overall);
  console.log('Qdrant:', health.qdrant.status);
  console.log('OpenAI:', health.openai.status);
}
```

### Get Bot Statistics
```javascript
async function getBotStats(botId) {
  const response = await fetch(`/api/vectors/${botId}`);
  const data = await response.json();
  
  if (data.success) {
    console.log('Total vectors:', data.stats.qdrant.vectorsCount);
    console.log('Files with embeddings:', data.stats.mongodb.filesWithEmbeddings);
    console.log('Total tokens used:', data.stats.bot.totalTokensUsed);
  }
}
```

## 🚨 Error Handling

### Common Error Scenarios

1. **OpenAI API Key Missing**
```json
{
  "success": false,
  "error": "OPENAI_API_KEY environment variable is required"
}
```

2. **Qdrant Connection Failed**
```json
{
  "success": false,
  "qdrant": {
    "status": "disconnected",
    "error": "Connection refused"
  }
}
```

3. **Rate Limiting**
```json
{
  "success": false,
  "error": "OpenAI API rate limit exceeded"
}
```

4. **Collection Not Found**
```json
{
  "success": true,
  "results": [],
  "collectionNotFound": true
}
```

## 🎯 Best Practices

### 1. Batch Processing
For multiple files, process embeddings in batches to avoid rate limits:

```javascript
async function processMultipleFiles(fileIds, botId) {
  const results = [];
  
  for (const fileId of fileIds) {
    try {
      const result = await fetch(`/api/vectors/process/${fileId}`, {
        method: 'POST'
      });
      
      results.push(await result.json());
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to process file ${fileId}:`, error);
    }
  }
  
  return results;
}
```

### 2. Smart Search Thresholds
Adjust search thresholds based on content type:

```javascript
const searchOptions = {
  // For technical documentation
  technical: { scoreThreshold: 0.8, limit: 3 },
  
  // For general content  
  general: { scoreThreshold: 0.7, limit: 5 },
  
  // For broad matching
  broad: { scoreThreshold: 0.6, limit: 10 },
};
```

### 3. Error Recovery
Implement retry logic for failed embeddings:

```javascript
async function processFileWithRetry(fileId, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(`/api/vectors/process/${fileId}`, {
        method: 'POST'
      });
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## 🔮 Next Steps

Your vector storage system is now ready! The next logical steps would be:

1. **Chat Interface**: Build a chat UI that uses the search functionality
2. **RAG Pipeline**: Integrate with OpenAI ChatGPT for response generation
3. **Advanced Features**: Add semantic caching, conversation memory, etc.
4. **Performance**: Add Redis caching for frequent searches
5. **Analytics**: Track search patterns and improve retrieval

The foundation is solid and production-ready! 🚀