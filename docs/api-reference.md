# 🔌 PlugRAG API Reference

> **Complete REST API documentation for the PlugRAG platform**

## 📋 **Table of Contents**
- [Authentication](#authentication)
- [Bot Management](#bot-management)
- [File Management](#file-management)
- [Vector Operations](#vector-operations)
- [Chat API](#chat-api)
- [Analytics](#analytics)
- [Webhooks](#webhooks)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [SDKs & Examples](#sdks--examples)

---

## 🔐 **Authentication**

PlugRAG uses **Clerk** for authentication with Bearer token authorization for protected routes and public access for chat endpoints.

### **Authentication Methods**

#### **Dashboard API (Protected)**
```javascript
// Automatic authentication in dashboard
const response = await fetch('/api/bots', {
  method: 'GET',
  // Clerk automatically handles auth headers
});
```

#### **External API Access**
```javascript
// Using Clerk session token
const token = await getToken();
const response = await fetch('/api/bots', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

#### **Public Chat API (No Auth Required)**
```javascript
// Public chat endpoints don't require authentication
const response = await fetch('/api/chat/bot_123', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "Hello!",
    sessionId: "session_abc123"
  })
});
```

---

## 🤖 **Bot Management**

### **List Bots**
```http
GET /api/bots
```

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10)
- `status` (string, optional): Filter by status (`active`, `inactive`, `all`)
- `search` (string, optional): Search by name or description

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "bot_123",
        "name": "Customer Support Bot",
        "description": "Handles customer inquiries",
        "status": "active",
        "analytics": {
          "totalMessages": 1250,
          "totalSessions": 89,
          "totalTokensUsed": 45230,
          "totalEmbeddings": 156,
          "lastActiveAt": "2025-01-15T10:30:00Z"
        },
        "fileCount": 12,
        "createdAt": "2025-01-01T00:00:00Z",
        "updatedAt": "2025-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### **Create Bot**
```http
POST /api/bots
```

**Request Body:**
```json
{
  "name": "Support Assistant",
  "description": "Customer support chatbot for technical queries",
  "customization": {
    "bubbleColor": "#3B82F6",
    "position": "bottom-right",
    "greeting": "How can I help you today?",
    "placeholder": "Type your message...",
    "title": "Support Chat"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bot created successfully",
  "data": {
    "id": "bot_new123",
    "name": "Support Assistant",
    "description": "Customer support chatbot for technical queries",
    "botKey": "key_abc123",
    "status": "active",
    "customization": { /* customization object */ },
    "analytics": {
      "totalMessages": 0,
      "totalSessions": 0,
      "totalTokensUsed": 0,
      "totalEmbeddings": 0,
      "lastActiveAt": "2025-01-15T12:00:00Z"
    },
    "vectorStorage": {
      "enabled": false,
      "collectionName": "",
      "provider": "qdrant"
    },
    "createdAt": "2025-01-15T12:00:00Z"
  }
}
```

### **Get Bot Details**
```http
GET /api/bots/{botId}
```

**Path Parameters:**
- `botId` (string, required): Bot identifier

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "bot_123",
    "name": "Customer Support Bot",
    "description": "Handles customer inquiries",
    "status": "active",
    "customization": {
      "bubbleColor": "#3B82F6",
      "position": "bottom-right",
      "greeting": "How can I help you today?",
      "placeholder": "Type your message...",
      "title": "Support Chat"
    },
    "analytics": {
      "totalMessages": 1250,
      "totalSessions": 89,
      "totalTokensUsed": 45230,
      "totalEmbeddings": 156,
      "lastActiveAt": "2025-01-15T10:30:00Z",
      "averageSessionLength": 4.2,
      "uniqueVisitors": 67
    },
    "vectorStorage": {
      "enabled": true,
      "collectionName": "user123_bot456",
      "provider": "qdrant",
      "dimensions": 1536,
      "model": "text-embedding-3-small"
    },
    "fileCount": 12,
    "fileStats": {
      "processing": 1,
      "completed": 10,
      "failed": 1
    },
    "limits": {
      "maxFilesPerBot": 50,
      "maxFileSize": 10485760,
      "messagesPerMonth": 1000
    },
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-15T10:30:00Z"
  }
}
```

### **Update Bot**
```http
PATCH /api/bots/{botId}
```

**Request Body:**
```json
{
  "name": "Updated Bot Name",
  "description": "Updated description",
  "status": "inactive",
  "customization": {
    "bubbleColor": "#EF4444",
    "greeting": "Welcome! How may I assist you?"
  }
}
```

### **Delete Bot**
```http
DELETE /api/bots/{botId}
```

**Response:**
```json
{
  "success": true,
  "message": "Bot and all associated data deleted successfully",
  "data": {
    "deletedBotId": "bot_123",
    "filesDeleted": 12,
    "vectorsDeleted": 156,
    "conversationsDeleted": 89
  }
}
```

---

## 📁 **File Management**

### **List Files**
```http
GET /api/files
```

**Query Parameters:**
- `botId` (string, required): Filter files by bot
- `status` (string, optional): Filter by processing status
- `page` (number, optional): Page number
- `limit` (number, optional): Items per page

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "file_123",
        "filename": "user-manual.pdf",
        "originalName": "Product User Manual.pdf",
        "fileSize": 2048576,
        "mimeType": "application/pdf",
        "status": "completed",
        "processingResult": {
          "chunksCreated": 23,
          "embeddingsGenerated": 23,
          "tokensUsed": 15420,
          "processingTime": 45.2
        },
        "uploadedAt": "2025-01-15T09:00:00Z",
        "processedAt": "2025-01-15T09:01:30Z"
      }
    ],
    "pagination": { /* pagination object */ }
  }
}
```

### **Upload File**
```http
POST /api/files
```

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `file` (file, required): File to upload
- `botId` (string, required): Target bot ID
- `options` (JSON string, optional): Processing options

**Processing Options:**
```json
{
  "generateEmbeddings": true,
  "chunkSize": 700,
  "overlap": 100,
  "customMetadata": {
    "category": "product-docs",
    "version": "v2.1"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "File uploaded and processing started",
  "data": {
    "id": "file_new123",
    "filename": "document.pdf",
    "status": "processing",
    "botId": "bot_456",
    "processingJobId": "job_789",
    "estimatedTime": "2-3 minutes"
  }
}
```

### **Upload from URL**
```http
POST /api/files/url
```

**Request Body:**
```json
{
  "url": "https://example.com/document.pdf",
  "botId": "bot_123",
  "options": {
    "generateEmbeddings": true,
    "customFilename": "external-doc.pdf"
  }
}
```

### **Get File Details**
```http
GET /api/files/{fileId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "file_123",
    "filename": "user-manual.pdf",
    "originalName": "Product User Manual.pdf",
    "fileSize": 2048576,
    "mimeType": "application/pdf",
    "status": "completed",
    "botId": "bot_456",
    "chunks": [
      {
        "id": "chunk_1",
        "content": "This section explains how to...",
        "tokens": 67,
        "hasEmbedding": true,
        "metadata": {
          "page": 1,
          "section": "Getting Started"
        }
      }
    ],
    "processingResult": {
      "chunksCreated": 23,
      "embeddingsGenerated": 23,
      "tokensUsed": 15420,
      "processingTime": 45.2,
      "errors": []
    },
    "uploadedAt": "2025-01-15T09:00:00Z",
    "processedAt": "2025-01-15T09:01:30Z"
  }
}
```

### **Delete File**
```http
DELETE /api/files/{fileId}
```

**Response:**
```json
{
  "success": true,
  "message": "File and associated vectors deleted successfully",
  "data": {
    "fileId": "file_123",
    "chunksDeleted": 23,
    "vectorsDeleted": 23
  }
}
```

### **Get File Info**
```http
GET /api/files/info
```

**Response:**
```json
{
  "success": true,
  "data": {
    "supportedFormats": [
      {
        "extension": ".pdf",
        "mimeType": "application/pdf",
        "maxSize": "50MB",
        "description": "Portable Document Format"
      },
      {
        "extension": ".docx",
        "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "maxSize": "50MB",
        "description": "Microsoft Word Document"
      }
    ],
    "limits": {
      "maxFileSize": 52428800,
      "maxFilesPerBot": 100,
      "supportedMimeTypes": [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "text/csv",
        "text/html"
      ]
    }
  }
}
```

---

## 🔍 **Vector Operations**

### **Health Check**
```http
GET /api/vectors
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "qdrantConnection": "connected",
    "openaiConnection": "connected",
    "totalCollections": 45,
    "totalVectors": 12890,
    "avgResponseTime": 23.4
  }
}
```

### **Semantic Search**
```http
POST /api/vectors/search
```

**Request Body:**
```json
{
  "botId": "bot_123",
  "query": "How to configure authentication settings?",
  "limit": 5,
  "scoreThreshold": 0.7,
  "filter": {
    "category": "configuration",
    "section": "authentication"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "How to configure authentication settings?",
    "results": [
      {
        "id": "chunk_456",
        "content": "Authentication can be configured in the settings panel...",
        "score": 0.89,
        "fileId": "file_123",
        "filename": "admin-guide.pdf",
        "metadata": {
          "page": 45,
          "section": "Authentication Setup"
        }
      }
    ],
    "totalFound": 12,
    "searchTime": 34.2
  }
}
```

### **Get Bot Vector Stats**
```http
GET /api/vectors/{botId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "botId": "bot_123",
    "collectionName": "user456_bot123",
    "vectorCount": 234,
    "dimensions": 1536,
    "embeddingModel": "text-embedding-3-small",
    "storageSize": "45.2 MB",
    "lastUpdated": "2025-01-15T10:30:00Z",
    "health": {
      "status": "healthy",
      "avgSearchTime": 23.4,
      "errorRate": 0.001
    }
  }
}
```

### **Initialize Bot Vector Storage**
```http
POST /api/vectors/{botId}
```

**Request Body:**
```json
{
  "dimensions": 1536,
  "embeddingModel": "text-embedding-3-small",
  "options": {
    "optimizeFor": "speed" // or "storage"
  }
}
```

### **Process File to Vectors**
```http
POST /api/vectors/process/{fileId}
```

**Request Body:**
```json
{
  "regenerate": false,
  "chunkOptions": {
    "chunkSize": 700,
    "overlap": 100
  }
}
```

---

## 💬 **Chat API (Public)**

### **Send Message**
```http
POST /api/chat/{botId}
```

**Request Body:**
```json
{
  "message": "How do I reset my password?",
  "sessionId": "session_abc123",
  "userFingerprint": "fp_xyz789", // optional
  "domain": "example.com", // optional
  "metadata": { // optional
    "userAgent": "Mozilla/5.0...",
    "referrer": "https://example.com/help"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "message": "To reset your password, go to the login page and click 'Forgot Password'...",
    "sessionId": "session_abc123",
    "messageId": "msg_456",
    "conversationId": "conv_789",
    "sources": [
      {
        "documentId": "file_123",
        "fileName": "user-guide.pdf",
        "chunkContent": "Password reset instructions...",
        "similarityScore": 0.92,
        "page": 12
      }
    ],
    "responseTime": 1234,
    "tokensUsed": 89,
    "hasRelevantContext": true
  }
}
```

### **Get Conversation History**
```http
GET /api/chat/{botId}?sessionId={sessionId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg_123",
        "role": "user",
        "content": "How do I reset my password?",
        "timestamp": "2025-01-15T10:00:00Z"
      },
      {
        "id": "msg_124",
        "role": "assistant",
        "content": "To reset your password...",
        "timestamp": "2025-01-15T10:00:05Z",
        "sources": [ /* sources array */ ],
        "tokensUsed": 89,
        "responseTime": 1234
      }
    ],
    "sessionId": "session_abc123",
    "conversationId": "conv_789",
    "totalMessages": 4
  }
}
```

### **Clear Conversation History**
```http
DELETE /api/chat/{botId}?sessionId={sessionId}
```

**Response:**
```json
{
  "success": true,
  "message": "Conversation history cleared successfully",
  "data": {
    "deletedCount": 1,
    "sessionId": "session_abc123"
  }
}
```

---

## 📊 **Analytics**

### **Bot Analytics**
```http
GET /api/bots/{botId}/analytics
```

**Query Parameters:**
- `period` (string): `today`, `week`, `month`, `quarter`, `year`
- `metrics` (array): Specific metrics to include

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "metrics": {
      "totalMessages": 1250,
      "totalSessions": 89,
      "uniqueVisitors": 67,
      "averageSessionLength": 4.2,
      "totalTokensUsed": 45230,
      "avgResponseTime": 1.8,
      "successRate": 0.94,
      "topQuestions": [
        {
          "question": "How to reset password?",
          "count": 23,
          "avgResponseTime": 1.2
        }
      ],
      "dailyStats": [
        {
          "date": "2025-01-01",
          "messages": 45,
          "sessions": 12,
          "uniqueVisitors": 9
        }
      ]
    }
  }
}
```

---

## 🔗 **Webhooks**

### **Clerk User Events**
```http
POST /api/webhooks/clerk
```

**Supported Events:**
- `user.created` - New user registration
- `user.updated` - User profile changes
- `user.deleted` - User account deletion

**Example Payload (user.created):**
```json
{
  "type": "user.created",
  "data": {
    "id": "user_123",
    "email_addresses": [
      {
        "email_address": "user@example.com",
        "id": "email_456"
      }
    ],
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

---

## ❌ **Error Handling**

### **Standard Error Response**
```json
{
  "success": false,
  "error": "Detailed error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Specific field error",
    "timestamp": "2025-01-15T10:00:00Z",
    "requestId": "req_123456"
  }
}
```

### **HTTP Status Codes**
- **200** - Success
- **201** - Created
- **400** - Bad Request (validation errors)
- **401** - Unauthorized (authentication required)
- **403** - Forbidden (access denied)
- **404** - Not Found
- **409** - Conflict (duplicate resource)
- **413** - Payload Too Large (file size limit)
- **422** - Unprocessable Entity (semantic errors)
- **429** - Too Many Requests (rate limited)
- **500** - Internal Server Error

### **Common Error Codes**
- `UNAUTHORIZED` - Missing or invalid authentication
- `BOT_NOT_FOUND` - Bot doesn't exist or access denied
- `FILE_TOO_LARGE` - File exceeds size limit
- `INVALID_FILE_FORMAT` - Unsupported file type
- `PROCESSING_FAILED` - File processing error
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `VECTOR_SEARCH_FAILED` - Vector database error
- `OPENAI_API_ERROR` - AI service error

---

## 🚦 **Rate Limiting**

### **Current Limits**
- **API Requests**: 1000/hour per user
- **File Uploads**: 50/hour per user  
- **Chat Messages**: 100/hour per bot (public)
- **Vector Searches**: 500/hour per user

### **Rate Limit Headers**
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 750
X-RateLimit-Reset: 1642694400
X-RateLimit-Retry-After: 60
```

### **Rate Limit Error Response**
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "limit": 1000,
    "remaining": 0,
    "resetTime": "2025-01-15T11:00:00Z"
  }
}
```

---

## 🛠️ **SDKs & Examples**

### **JavaScript/Node.js**
```javascript
// Initialize PlugRAG client
const plugrag = new PlugRAG({
  apiKey: 'your-api-key',
  baseURL: 'https://api.plugrag.com'
});

// Create a bot
const bot = await plugrag.bots.create({
  name: 'Support Assistant',
  description: 'Customer support chatbot'
});

// Upload file
const file = await plugrag.files.upload(bot.id, {
  file: fileBuffer,
  filename: 'manual.pdf',
  options: { generateEmbeddings: true }
});

// Send chat message
const response = await plugrag.chat.sendMessage(bot.id, {
  message: 'Hello!',
  sessionId: 'session_123'
});
```

### **Python**
```python
import plugrag

# Initialize client
client = plugrag.Client(api_key='your-api-key')

# Create bot
bot = client.bots.create(
    name='Support Assistant',
    description='Customer support chatbot'
)

# Upload file
with open('manual.pdf', 'rb') as f:
    file_result = client.files.upload(
        bot_id=bot.id,
        file=f,
        options={'generate_embeddings': True}
    )

# Send message
response = client.chat.send_message(
    bot_id=bot.id,
    message='Hello!',
    session_id='session_123'
)
```

### **cURL Examples**
```bash
# Create bot
curl -X POST https://api.plugrag.com/api/bots \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Support Assistant",
    "description": "Customer support chatbot"
  }'

# Upload file
curl -X POST https://api.plugrag.com/api/files \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@manual.pdf" \
  -F "botId=bot_123" \
  -F 'options={"generateEmbeddings":true}'

# Send chat message (public)
curl -X POST https://api.plugrag.com/api/chat/bot_123 \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello!",
    "sessionId": "session_123"
  }'
```

---

## 🔧 **Testing & Debugging**

### **API Health Check**
```bash
curl https://api.plugrag.com/api/vectors/health
```

### **Test Authentication**
```javascript
const response = await fetch('/api/bots', {
  headers: { 'Authorization': `Bearer ${token}` }
});

if (response.status === 401) {
  console.error('Authentication failed');
}
```

### **Enable Debug Mode**
```javascript
// Add debug headers to requests
const response = await fetch('/api/bots', {
  headers: { 
    'X-Debug': 'true',
    'X-Request-ID': 'unique-request-id'
  }
});
```

---

<div align="center">

**📚 Need more help?**  
[View Examples](./examples) • [Join Discord](https://discord.gg/plugrag) • [Contact Support](mailto:support@plugrag.com)

</div>