# 🏗️ PlugRAG Architecture Documentation

This document provides a comprehensive overview of the PlugRAG platform architecture, including system design, data flow, technology stack, and key components.

## 📖 Table of Contents

- [System Overview](#system-overview)
- [Architecture Layers](#architecture-layers)
- [Data Flow](#data-flow)
- [Technology Stack](#technology-stack)
- [Core Components](#core-components)
- [Database Schema](#database-schema)
- [Security Architecture](#security-architecture)
- [Scaling Considerations](#scaling-considerations)

---

## 🌐 System Overview

PlugRAG is built as a modern, serverless SaaS platform using **Next.js 16** with the App Router architecture. The system follows a **multi-tenant**, **microservices-inspired** design with clear separation of concerns.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Web App    │  │ Chat Widget  │  │   REST API   │      │
│  │  (Next.js)   │  │  (embed.js)  │  │   Clients    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   AUTHENTICATION LAYER                       │
│                     ┌──────────────┐                         │
│                     │    Clerk     │                         │
│                     │ (Auth & User)│                         │
│                     └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER (Next.js)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Bots   │  │  Files   │  │   Chat   │  │ Webhooks │   │
│  │   API    │  │   API    │  │   API    │  │   API    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     SERVICE LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Chat Service │  │ File Service │  │  RAG Service │      │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤      │
│  │   API Key    │  │   Text       │  │    Intent    │      │
│  │   Service    │  │  Extractor   │  │  Classifier  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKGROUND PROCESSING                      │
│            ┌─────────────────────────────┐                  │
│            │   BullMQ Worker (Redis)     │                  │
│            │  • File Processing Queue    │                  │
│            │  • Vector Embedding         │                  │
│            │  • Chunking & Indexing      │                  │
│            └─────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     DATA LAYER                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ MongoDB  │  │  Qdrant  │  │  Redis   │  │  AWS S3  │   │
│  │ (Bots,   │  │ (Vectors)│  │ (Queue)  │  │ (Files)  │   │
│  │  Files)  │  │          │  │          │  │          │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                          │
│            ┌──────────────┐  ┌──────────────┐              │
│            │   OpenAI     │  │    Clerk     │              │
│            │  (GPT-4 &    │  │ (Webhooks)   │              │
│            │  Embeddings) │  │              │              │
│            └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Architecture Layers

### 1. Client Layer

**Components:**
- **Web Application** (Next.js React)
- **Embeddable Chat Widget** (Vanilla JavaScript)
- **REST API Clients** (External integrations)

**Technologies:**
- React 19.1.0
- Next.js 16.1.1 App Router
- Tailwind CSS 4

**Responsibilities:**
- User interface rendering
- Client-side state management
- API communication
- Session management

### 2. Authentication Layer

**Provider:** Clerk

**Features:**
- JWT-based authentication
- User management
- SSO support
- MFA capabilities
- Webhook lifecycle events

**Security:**
- Authorization headers (Bearer tokens)
- CSRF protection via JWT
- Session management
- Role-based access control

### 3. API Layer

**Framework:** Next.js API Routes (Serverless)

**Endpoints:**

#### Bot Management
- `GET /api/bots` - List user's bots
- `POST /api/bots` - Create new bot
- `GET /api/bots/[id]` - Get bot details
- `PATCH /api/bots/[id]` - Update bot configuration
- `DELETE /api/bots/[id]` - Delete bot

#### File Management
- `POST /api/files/upload/init` - Initialize upload
- `POST /api/files/upload/complete` - Complete upload
- `GET /api/files` - List bot files
- `GET /api/files/[id]` - Get file details
- `DELETE /api/files/[id]` - Delete file

#### Chat
- `POST /api/chat/[botId]` - Send message (public)
- `GET /api/chat/[botId]/conversations` - List conversations
- `GET /api/chat/[botId]/conversations/[sessionId]` - Get conversation history

#### System
- `GET /api/health` - Health check
- `POST /api/webhooks/clerk` - Clerk user lifecycle webhooks

**Middleware:**
- Authentication (Clerk)
- Rate limiting
- Input sanitization
- Error handling

### 4. Service Layer

#### Chat Service (`chatService.js`)
- Message processing
- Conversation management
- RAG orchestration
- Response streaming

#### RAG Service (`ragService.js`)
- Vector similarity search
- Context retrieval
- Prompt engineering
- GPT-4 integration

#### File Service (`fileService.js`)
- File metadata management
- Upload coordination
- Deletion handling
- Status tracking

#### API Key Service (`apiKeyService.js`)
- Encryption/decryption (AES-256-CBC)
- Key validation
- Fallback management
- Security enforcement

#### FAQ Service (`faqService.js`)
- FAQ matching
- Intent detection
- Direct answer retrieval

#### Intent Classifier (`intentClassifier.js`)
- Message categorization
- Routing logic
- FAQ vs RAG decision

### 5. Background Processing Layer

**Technology:** BullMQ + Redis

**Worker Process:** `start-worker.js`

**Jobs:**
- File text extraction
- Document chunking
- Vector embedding generation
- Qdrant indexing
- Error handling and retries

**Queue Configuration:**
- Concurrent jobs: 3
- Retry attempts: 3
- Retry delays: Exponential backoff
- Job timeout: 5 minutes

### 6. Data Layer

#### MongoDB (Primary Database)
- **Collections:** Users, Bots, Files, Conversations
- **ODM:** Mongoose
- **Features:** Indexes, validation, middleware

#### Qdrant (Vector Database)
- **Collections:** Per-bot collections
- **Vectors:** 1536 dimensions (text-embedding-3-small)
- **Storage:** Persistent disk storage

#### Redis (Job Queue & Cache)
- **Usage:** BullMQ queues
- **Persistence:** AOF (Append-Only File)

#### AWS S3 (File Storage)
- **Usage:** Raw file storage
- **Access:** Presigned URLs
- **Security:** IAM roles, bucket policies

### 7. External Services

#### OpenAI
- **GPT-4 Turbo** - Chat completions
- **text-embedding-3-small** - Document embeddings (1536D)

#### Clerk
- Authentication
- User management
- Webhook events

---

## 🔄 Data Flow

### File Upload & Processing Flow

```
1. User uploads file via dashboard
   ↓
2. Frontend requests presigned URL from /api/files/upload/init
   ↓
3. File uploaded directly to S3
   ↓
4. Frontend calls /api/files/upload/complete
   ↓
5. API creates File record in MongoDB (status: 'processing')
   ↓
6. Job added to BullMQ queue
   ↓
7. Worker picks up job:
   - Downloads file from S3
   - Extracts text (PDF, DOCX, etc.)
   - Chunks text (RecursiveCharacterTextSplitter)
   - Generates embeddings (OpenAI)
   - Stores vectors in Qdrant
   - Updates File status to 'completed'
   ↓
8. File ready for RAG queries
```

### Chat Message Flow

```
1. User sends message via chat widget
   ↓
2. POST /api/chat/[botId] receives message
   ↓
3. Rate limiting check (IP + session)
   ↓
4. Input sanitization & validation
   ↓
5. Intent classification:
   - FAQ match? → Return FAQ answer
   - RAG needed? → Continue to RAG pipeline
   ↓
6. RAG Pipeline:
   - Generate embedding for user query
   - Vector search in Qdrant (top 3 similar chunks)
   - Build context from retrieved documents
   - Create GPT-4 prompt with context
   - Stream response from OpenAI
   ↓
7. Save conversation to MongoDB
   ↓
8. Update bot analytics
   ↓
9. Return response to client
```

### Bot Creation Flow

```
1. User fills bot creation form
   ↓
2. POST /api/bots with bot configuration
   ↓
3. Authentication check (Clerk)
   ↓
4. Validate and sanitize inputs
   ↓
5. Encrypt OpenAI API key (if provided)
   ↓
6. Create Bot document in MongoDB
   ↓
7. Create Qdrant collection for bot
   ↓
8. Return bot details to client
   ↓
9. User redirected to bot dashboard
```

---

## 🛠️ Technology Stack

### Frontend Technologies

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 16.1.1 | React framework, SSR, routing |
| React | 19.1.0 | UI components |
| Tailwind CSS | 4.0 | Styling |
| Clerk React | 6.33.6 | Authentication UI |

### Backend Technologies

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20+ | Runtime |
| Next.js API Routes | 16.1.1 | Serverless API |
| Mongoose | 8.19.1 | MongoDB ODM |
| BullMQ | 5.66.3 | Job queue |

### AI & ML

| Technology | Version | Purpose |
|-----------|---------|---------|
| OpenAI | 6.6.0 | GPT-4, embeddings |
| LangChain OpenAI | 1.0.0 | Document processing |
| LangChain Qdrant | 1.0.0 | Vector store integration |
| Tiktoken | 1.0.22 | Token counting |

### Databases & Storage

| Technology | Purpose |
|-----------|---------|
| MongoDB Atlas | Primary database |
| Qdrant | Vector database |
| Redis 7 | Job queue, caching |
| AWS S3 | File storage |

### Document Processing

| Technology | Purpose |
|-----------|---------|
| Mammoth | DOCX extraction |
| PDF2JSON | PDF parsing |
| PapaParse | CSV processing |
| Cheerio | HTML processing |

---

## 🧩 Core Components

### Models (MongoDB Schemas)

#### Bot Model
```javascript
{
  userId: String,          // Clerk user ID
  name: String,           // Bot name
  description: String,    // Bot description
  status: String,         // 'active' | 'inactive'
  openaiApiConfig: {
    apiKeyEncrypted: String,  // AES-256-CBC encrypted
    model: String,            // GPT model
    temperature: Number,      // 0.0 - 1.0
    maxTokens: Number,
    fallbackEnabled: Boolean
  },
  systemPrompt: String,
  welcomeMessage: String,
  domainWhitelist: [String],
  analytics: {
    totalMessages: Number,
    totalConversations: Number,
    lastMessageAt: Date
  },
  faqs: [{ question, answer }],
  qdrantCollectionName: String,
  createdAt: Date,
  updatedAt: Date
}
```

#### File Model
```javascript
{
  botId: ObjectId,
  userId: String,
  fileName: String,
  fileSize: Number,
  fileType: String,        // 'pdf', 'docx', etc.
  status: String,          // 'processing', 'completed', 'failed'
  s3Key: String,
  s3Url: String,
  metadata: {
    extractedText: String,
    pageCount: Number,
    chunkCount: Number,
    errorMessage: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### Conversation Model
```javascript
{
  botId: ObjectId,
  sessionId: String,       // UUID v4
  messages: [{
    role: String,          // 'user' | 'assistant'
    content: String,
    timestamp: Date,
    metadata: Object
  }],
  sessionMetadata: {
    userFingerprint: String,
    domain: String,
    ipAddress: String,
    userAgent: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### User Model
```javascript
{
  clerkUserId: String,     // Unique Clerk ID
  email: String,
  firstName: String,
  lastName: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Services

#### ChatService
**Location:** `src/lib/core/chatService.js`

**Key Methods:**
- `sendMessage(bot, message, sessionId, sessionMetadata)` - Process chat message
- `getOrCreateConversation(botId, sessionId)` - Conversation management
- `streamResponse(prompt, apiKey)` - OpenAI streaming

#### RAGService
**Location:** `src/lib/core/ragService.js`

**Key Methods:**
- `generateResponse(bot, message, apiKey)` - Main RAG pipeline
- `retrieveContext(botId, query)` - Vector search
- `buildPrompt(context, query, systemPrompt)` - Prompt engineering

#### FileService
**Location:** `src/lib/core/fileService.js`

**Key Methods:**
- `initiateUpload(botId, fileName, fileType)` - Start upload
- `completeUpload(fileId, s3Key)` - Finish upload
- `deleteFile(fileId)` - Remove file and vectors

### Utilities

#### Encryption
**Location:** `src/lib/utils/encryption.js`

**Algorithm:** AES-256-CBC + HMAC-SHA256

**Format:** `iv:authTag:encrypted`

#### Rate Limiting
**Location:** `src/lib/utils/rateLimit.js`

**Limits:**
- IP-based: 100 requests/hour
- Session-based: 50 messages/hour

#### Sanitization
**Location:** `src/lib/utils/sanitization.js`

**Protection:**
- NoSQL injection
- Control characters
- Length limits
- Pattern validation

---

## 🔒 Security Architecture

### Authentication & Authorization

- **Provider:** Clerk (JWT-based)
- **Token Location:** Authorization header
- **CSRF Protection:** Not needed (JWT in headers)
- **Session Management:** Clerk handles sessions

### Data Encryption

#### At Rest
- **API Keys:** AES-256-CBC + HMAC-SHA256
- **Database:** MongoDB encrypted storage
- **Files:** S3 server-side encryption

#### In Transit
- **HTTPS:** All API communication
- **TLS:** Database connections
- **Signed URLs:** S3 presigned URLs

### Input Validation

- **Sanitization:** Remove control characters
- **Validation:** Type and length checks
- **NoSQL Injection:** Pattern detection
- **Rate Limiting:** Prevent abuse

### Multi-Tenancy

- **Data Isolation:** User ID filtering
- **Qdrant Collections:** Per-bot collections
- **S3 Paths:** User-scoped prefixes
- **Database Queries:** Always include userId

---

## 📈 Scaling Considerations

### Horizontal Scaling

**Stateless API:**
- Next.js serverless functions
- Auto-scaling on deployment platforms
- No server-side sessions

**Worker Scaling:**
- Multiple worker instances
- Redis-based job distribution
- Independent scaling from API

### Vertical Scaling

**Database:**
- MongoDB Atlas auto-scaling
- Read replicas for analytics
- Sharding for large deployments

**Vector Database:**
- Qdrant clustering
- Collection-per-bot isolation
- Horizontal pod autoscaling

### Performance Optimization

**Caching:**
- Redis for frequent queries
- CDN for static assets
- Client-side caching

**Database Indexes:**
- User ID + created_at
- Bot ID + status
- Session ID lookups

**Lazy Loading:**
- Infinite scroll for conversations
- Pagination for file lists
- On-demand vector loading

### Cost Optimization

**OpenAI Usage:**
- Bring-your-own-key option
- Token limit enforcement
- Caching common queries

**Storage:**
- S3 lifecycle policies
- Vector cleanup on file deletion
- MongoDB TTL indexes

---

## 🎯 Design Principles

1. **Separation of Concerns** - Clear layer boundaries
2. **Single Responsibility** - Each service has one job
3. **Dependency Injection** - Testable, modular code
4. **Fail Fast** - Early validation and error handling
5. **Idempotency** - Safe retry mechanisms
6. **Eventual Consistency** - Background processing tolerance
7. **Defense in Depth** - Multiple security layers

---

## 🔮 Future Enhancements

### Short Term
- Redis caching for RAG contexts
- Webhook notifications for file processing
- Advanced analytics queries

### Medium Term
- GraphQL API option
- Real-time chat via WebSockets
- Multi-region deployment

### Long Term
- Kubernetes orchestration
- Custom embedding models
- Multi-modal RAG (images, audio)

---

## 📚 Additional Resources

- [API Reference](API-REFERENCE.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Getting Started](GETTING-STARTED.md)
- [Docker Documentation](../DOCKER.md)
