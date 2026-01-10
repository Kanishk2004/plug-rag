# 🔌 PlugRAG API Reference

Complete API documentation for the PlugRAG platform. All authenticated endpoints require a valid Clerk JWT token in the Authorization header.

## 📖 Table of Contents

- [Authentication](#authentication)
- [Bot Management](#bot-management-api)
- [File Management](#file-management-api)
- [Chat API](#chat-api)
- [System API](#system-api)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

---

## 🔐 Authentication

All protected endpoints require authentication via Clerk.

### Authorization Header

```http
Authorization: Bearer <clerk_jwt_token>
```

### Getting Your Token

1. Sign in to the application
2. Token is automatically included in requests from the dashboard
3. For external API calls, obtain token from Clerk SDK

### Public Endpoints

The following endpoints do **NOT** require authentication:
- `POST /api/chat/[botId]` - Public chat endpoint
- `GET /api/health` - Health check

---

## 🤖 Bot Management API

### List Bots

Get all bots for the authenticated user.

**Endpoint:** `GET /api/bots`

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | string | No | Search by bot name |
| `status` | string | No | Filter by status ('active', 'inactive') |

**Response:**
```json
{
  "bots": [
    {
      "_id": "bot_123",
      "name": "Customer Support Bot",
      "description": "Helps customers with product questions",
      "status": "active",
      "createdAt": "2026-01-10T10:00:00.000Z",
      "analytics": {
        "totalMessages": 150,
        "totalConversations": 45,
        "lastMessageAt": "2026-01-10T15:30:00.000Z"
      },
      "qdrantCollectionName": "bot_123_collection"
    }
  ]
}
```

**Example:**
```bash
curl -X GET "https://your-domain.com/api/bots?status=active" \
  -H "Authorization: Bearer <token>"
```

---

### Create Bot

Create a new chatbot.

**Endpoint:** `POST /api/bots`

**Authentication:** Required

**Request Body:**
```json
{
  "name": "My Support Bot",
  "description": "Answers customer questions",
  "systemPrompt": "You are a helpful customer support assistant.",
  "welcomeMessage": "Hi! How can I help you today?",
  "openaiApiConfig": {
    "apiKey": "sk-...",           // Optional: BYOK
    "model": "gpt-4",
    "temperature": 0.7,
    "maxTokens": 500,
    "fallbackEnabled": true
  },
  "domainWhitelist": ["example.com", "*.example.com"],
  "faqs": [
    {
      "question": "What are your hours?",
      "answer": "We're open Monday-Friday, 9 AM to 5 PM EST."
    }
  ]
}
```

**Response:**
```json
{
  "bot": {
    "_id": "bot_123",
    "name": "My Support Bot",
    "status": "active",
    "createdAt": "2026-01-10T10:00:00.000Z",
    "qdrantCollectionName": "bot_123_collection"
  }
}
```

**Example:**
```bash
curl -X POST "https://your-domain.com/api/bots" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Support Bot",
    "description": "Customer support",
    "systemPrompt": "You are helpful.",
    "welcomeMessage": "Hello!",
    "openaiApiConfig": {
      "model": "gpt-4",
      "temperature": 0.7,
      "maxTokens": 500
    }
  }'
```

---

### Get Bot

Get details of a specific bot.

**Endpoint:** `GET /api/bots/[id]`

**Authentication:** Required

**Response:**
```json
{
  "bot": {
    "_id": "bot_123",
    "name": "Customer Support Bot",
    "description": "Helps customers",
    "status": "active",
    "systemPrompt": "You are a helpful assistant.",
    "welcomeMessage": "Hi! How can I help?",
    "openaiApiConfig": {
      "model": "gpt-4",
      "temperature": 0.7,
      "maxTokens": 500,
      "fallbackEnabled": true,
      "hasCustomKey": true
    },
    "domainWhitelist": ["example.com"],
    "faqs": [...],
    "analytics": {...},
    "createdAt": "2026-01-10T10:00:00.000Z",
    "updatedAt": "2026-01-10T12:00:00.000Z"
  }
}
```

**Example:**
```bash
curl -X GET "https://your-domain.com/api/bots/bot_123" \
  -H "Authorization: Bearer <token>"
```

---

### Update Bot

Update bot configuration.

**Endpoint:** `PATCH /api/bots/[id]`

**Authentication:** Required

**Request Body:**
```json
{
  "name": "Updated Bot Name",
  "description": "Updated description",
  "status": "active",
  "systemPrompt": "Updated prompt",
  "welcomeMessage": "Updated welcome",
  "openaiApiConfig": {
    "model": "gpt-4-turbo",
    "temperature": 0.8,
    "maxTokens": 600
  },
  "domainWhitelist": ["newdomain.com"],
  "faqs": [...]
}
```

**Response:**
```json
{
  "bot": {
    "_id": "bot_123",
    "name": "Updated Bot Name",
    ...
  }
}
```

**Example:**
```bash
curl -X PATCH "https://your-domain.com/api/bots/bot_123" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Name", "status": "inactive"}'
```

---

### Delete Bot

Delete a bot and all associated data.

**Endpoint:** `DELETE /api/bots/[id]`

**Authentication:** Required

**Response:**
```json
{
  "message": "Bot deleted successfully"
}
```

**Notes:**
- Deletes all bot files
- Deletes Qdrant collection
- Deletes all conversations
- **This action is irreversible**

**Example:**
```bash
curl -X DELETE "https://your-domain.com/api/bots/bot_123" \
  -H "Authorization: Bearer <token>"
```

---

## 📁 File Management API

### List Files

Get all files for a specific bot.

**Endpoint:** `GET /api/files?botId=[botId]`

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `botId` | string | Yes | Bot ID |
| `status` | string | No | Filter by status |

**Response:**
```json
{
  "files": [
    {
      "_id": "file_123",
      "botId": "bot_123",
      "fileName": "product-manual.pdf",
      "fileSize": 1048576,
      "fileType": "pdf",
      "status": "completed",
      "s3Url": "https://s3.amazonaws.com/...",
      "metadata": {
        "pageCount": 50,
        "chunkCount": 125
      },
      "createdAt": "2026-01-10T10:00:00.000Z"
    }
  ],
  "totalCount": 15
}
```

**Example:**
```bash
curl -X GET "https://your-domain.com/api/files?botId=bot_123" \
  -H "Authorization: Bearer <token>"
```

---

### Initialize File Upload

Get presigned S3 URL for file upload.

**Endpoint:** `POST /api/files/upload/init`

**Authentication:** Required

**Request Body:**
```json
{
  "botId": "bot_123",
  "fileName": "product-manual.pdf",
  "fileType": "pdf",
  "fileSize": 1048576
}
```

**Response:**
```json
{
  "fileId": "file_123",
  "uploadUrl": "https://s3.amazonaws.com/presigned-url",
  "s3Key": "uploads/user_123/bot_123/file_123.pdf"
}
```

**Supported File Types:**
- `pdf` - PDF documents
- `docx` - Microsoft Word
- `txt` - Plain text
- `md` - Markdown
- `csv` - CSV files
- `html` - HTML files

**File Size Limits:**
- Max 50 MB per file

**Example:**
```bash
curl -X POST "https://your-domain.com/api/files/upload/init" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "botId": "bot_123",
    "fileName": "manual.pdf",
    "fileType": "pdf",
    "fileSize": 1048576
  }'
```

---

### Complete File Upload

Finalize upload and start processing.

**Endpoint:** `POST /api/files/upload/complete`

**Authentication:** Required

**Request Body:**
```json
{
  "fileId": "file_123",
  "s3Key": "uploads/user_123/bot_123/file_123.pdf"
}
```

**Response:**
```json
{
  "file": {
    "_id": "file_123",
    "status": "processing",
    "message": "File uploaded successfully. Processing started."
  }
}
```

**Processing Steps:**
1. File queued for processing
2. Text extraction
3. Chunking
4. Embedding generation
5. Vector storage in Qdrant
6. Status updated to 'completed'

**Example:**
```bash
curl -X POST "https://your-domain.com/api/files/upload/complete" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "file_123",
    "s3Key": "uploads/user_123/bot_123/file_123.pdf"
  }'
```

---

### Get File Details

Get information about a specific file.

**Endpoint:** `GET /api/files/[id]`

**Authentication:** Required

**Response:**
```json
{
  "file": {
    "_id": "file_123",
    "botId": "bot_123",
    "fileName": "manual.pdf",
    "fileSize": 1048576,
    "fileType": "pdf",
    "status": "completed",
    "s3Url": "https://s3.amazonaws.com/...",
    "metadata": {
      "pageCount": 50,
      "chunkCount": 125,
      "extractedText": "..." 
    },
    "createdAt": "2026-01-10T10:00:00.000Z",
    "updatedAt": "2026-01-10T10:05:00.000Z"
  }
}
```

**Example:**
```bash
curl -X GET "https://your-domain.com/api/files/file_123" \
  -H "Authorization: Bearer <token>"
```

---

### Delete File

Delete a file and its vectors.

**Endpoint:** `DELETE /api/files/[id]`

**Authentication:** Required

**Response:**
```json
{
  "message": "File deleted successfully"
}
```

**Notes:**
- Deletes S3 object
- Deletes vectors from Qdrant
- Deletes MongoDB record

**Example:**
```bash
curl -X DELETE "https://your-domain.com/api/files/file_123" \
  -H "Authorization: Bearer <token>"
```

---

## 💬 Chat API

### Send Message

Send a chat message to a bot.

**Endpoint:** `POST /api/chat/[botId]`

**Authentication:** NOT required (public endpoint)

**Request Body:**
```json
{
  "message": "What are your business hours?",
  "sessionId": "uuid-v4-session-id",
  "domain": "example.com",
  "userFingerprint": "fp_abc123"
}
```

**Response:**
```json
{
  "response": "We're open Monday through Friday, 9 AM to 5 PM EST.",
  "conversationId": "conv_123",
  "sessionId": "uuid-v4-session-id"
}
```

**Rate Limits:**
- **IP-based:** 100 requests/hour
- **Session-based:** 50 messages/hour

**Example:**
```bash
curl -X POST "https://your-domain.com/api/chat/bot_123" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello",
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "domain": "example.com",
    "userFingerprint": "fp_abc123"
  }'
```

---

### Get Conversations

List all conversations for a bot.

**Endpoint:** `GET /api/chat/[botId]/conversations`

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Results per page (default: 20) |
| `domain` | string | No | Filter by domain |

**Response:**
```json
{
  "conversations": [
    {
      "_id": "conv_123",
      "sessionId": "uuid-v4",
      "messageCount": 5,
      "lastMessage": "Thank you!",
      "sessionMetadata": {
        "domain": "example.com",
        "userFingerprint": "fp_abc123"
      },
      "createdAt": "2026-01-10T10:00:00.000Z",
      "updatedAt": "2026-01-10T10:15:00.000Z"
    }
  ],
  "totalCount": 45,
  "currentPage": 1,
  "totalPages": 3
}
```

**Example:**
```bash
curl -X GET "https://your-domain.com/api/chat/bot_123/conversations?page=1&limit=20" \
  -H "Authorization: Bearer <token>"
```

---

### Get Conversation Details

Get full message history for a conversation.

**Endpoint:** `GET /api/chat/[botId]/conversations/[sessionId]`

**Authentication:** Required

**Response:**
```json
{
  "conversation": {
    "_id": "conv_123",
    "sessionId": "uuid-v4",
    "messages": [
      {
        "role": "user",
        "content": "What are your hours?",
        "timestamp": "2026-01-10T10:00:00.000Z"
      },
      {
        "role": "assistant",
        "content": "We're open 9 AM to 5 PM EST.",
        "timestamp": "2026-01-10T10:00:05.000Z"
      }
    ],
    "sessionMetadata": {
      "domain": "example.com",
      "userFingerprint": "fp_abc123",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0..."
    },
    "createdAt": "2026-01-10T10:00:00.000Z"
  }
}
```

**Example:**
```bash
curl -X GET "https://your-domain.com/api/chat/bot_123/conversations/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

## ⚙️ System API

### Health Check

Check API health status.

**Endpoint:** `GET /api/health`

**Authentication:** NOT required

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-10T10:00:00.000Z",
  "services": {
    "mongodb": "connected",
    "qdrant": "connected",
    "redis": "connected"
  }
}
```

**Example:**
```bash
curl -X GET "https://your-domain.com/api/health"
```

---

### Clerk Webhooks

Receive user lifecycle events from Clerk.

**Endpoint:** `POST /api/webhooks/clerk`

**Authentication:** Svix webhook signature

**Events Handled:**
- `user.created` - Create user in database
- `user.updated` - Update user information
- `user.deleted` - Clean up user data

**Request Body:**
```json
{
  "type": "user.created",
  "data": {
    "id": "user_123",
    "email_addresses": [...],
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

**Response:**
```json
{
  "received": true
}
```

---

## ❌ Error Handling

All API errors follow a consistent format:

### Error Response Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

### HTTP Status Codes

| Status | Meaning | Usage |
|--------|---------|-------|
| 200 | OK | Successful request |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Missing/invalid auth |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Common Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Input validation failed |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Access denied |
| `NOT_FOUND` | Resource not found |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `BOT_NOT_FOUND` | Bot doesn't exist |
| `FILE_NOT_FOUND` | File doesn't exist |
| `INVALID_API_KEY` | OpenAI key invalid |
| `PROCESSING_ERROR` | File processing failed |
| `DOMAIN_NOT_WHITELISTED` | Domain not allowed |

### Error Examples

#### Validation Error
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "name": "Bot name is required",
    "systemPrompt": "Must be at least 10 characters"
  }
}
```

#### Rate Limit Error
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "limit": 50,
    "reset": "2026-01-10T11:00:00.000Z",
    "retryAfter": 3600
  }
}
```

#### Not Found Error
```json
{
  "error": "Bot not found",
  "code": "BOT_NOT_FOUND",
  "details": {
    "botId": "bot_123"
  }
}
```

---

## 🚦 Rate Limiting

### Limits

| Endpoint Type | Limit | Window | Identifier |
|--------------|-------|--------|------------|
| Chat API (IP) | 100 requests | 1 hour | IP Address |
| Chat API (Session) | 50 messages | 1 hour | Session ID |
| Authenticated API | 1000 requests | 1 hour | User ID |

### Rate Limit Headers

Responses include rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704884400
```

### Handling Rate Limits

When rate limited, you'll receive a 429 response:

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "limit": 100,
    "reset": "2026-01-10T11:00:00.000Z",
    "retryAfter": 3600
  }
}
```

**Best Practices:**
- Respect the `retryAfter` value
- Implement exponential backoff
- Cache responses when possible
- Use session IDs consistently

---

## 🌐 CORS

Cross-Origin Resource Sharing (CORS) is configured as follows:

### Allowed Origins
- Dashboard: Same origin
- Chat widget: Any origin (public endpoint)

### Preflight Requests

The API supports OPTIONS requests for CORS preflight:

```http
OPTIONS /api/chat/bot_123
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

---

## 🔗 Webhooks

### File Processing Events

Configure webhooks to receive notifications about file processing:

**Events:**
- `file.processing.started`
- `file.processing.completed`
- `file.processing.failed`

**Payload:**
```json
{
  "event": "file.processing.completed",
  "fileId": "file_123",
  "botId": "bot_123",
  "status": "completed",
  "timestamp": "2026-01-10T10:05:00.000Z",
  "metadata": {
    "chunkCount": 125
  }
}
```

---

## 📊 Analytics API

### Bot Analytics

Get analytics data for a bot.

**Endpoint:** `GET /api/bots/[id]/analytics`

**Authentication:** Required

**Response:**
```json
{
  "analytics": {
    "totalMessages": 1500,
    "totalConversations": 450,
    "averageMessagesPerConversation": 3.3,
    "topDomains": [
      { "domain": "example.com", "count": 800 },
      { "domain": "app.example.com", "count": 500 }
    ],
    "messagesByDay": [
      { "date": "2026-01-10", "count": 150 }
    ],
    "lastMessageAt": "2026-01-10T15:30:00.000Z"
  }
}
```

---

## 🧪 Testing

### Test Endpoint

Use the health endpoint for connectivity testing:

```bash
curl https://your-domain.com/api/health
```

### Example cURL Commands

See [examples](examples/) folder for complete cURL examples for all endpoints.

---

## 📚 Additional Resources

- [Getting Started Guide](GETTING-STARTED.md)
- [Architecture Documentation](ARCHITECTURE.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Main README](../README.md)

---

## 🆘 Support

For API support:
- Documentation: This file
- Issues: GitHub Issues
- Email: support@plugrag.com
