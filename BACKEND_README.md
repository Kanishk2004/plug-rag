# PlugRAG Backend - API & Services Documentation

> **⚠️ Development Status**: This application is currently in **early development stage** and not production-ready. Many features are still being implemented or may have limited functionality.

## 🚀 Overview

PlugRAG Backend provides the core API services for the chatbot platform, including user management, bot creation, file processing, vector storage, and chat functionality. Built with Next.js 15 App Router and modern serverless architecture.

## 📚 Tech Stack

### Core Framework
- **Next.js 15.5.5** - App Router with API routes
- **React 19.1.0** - UI components and hooks
- **Node.js** - Runtime environment

### Authentication & User Management
- **Clerk** - Complete authentication solution
- **Svix** - Webhook handling for user lifecycle events

### Database & Storage
- **MongoDB** - Primary database with Mongoose ODM
- **Qdrant** - Vector database for embeddings
- **Vector Storage** - Hybrid storage with caching

### AI & Language Processing
- **OpenAI API** - Text embeddings and completions
- **LangChain** - Document processing and text splitting
- **Text Extractors** - Support for PDF, DOCX, CSV, TXT, MD, HTML

### File Processing
- **Mammoth** - DOCX processing
- **PDF2JSON** - PDF text extraction
- **PapaParse** - CSV parsing
- **Cheerio** - HTML processing

## 🏗️ Architecture

### API Route Structure
```
src/app/api/
├── bots/                     # Bot management
│   ├── route.js             # List bots, Create bot
│   └── [id]/
│       └── route.js         # Get, Update, Delete individual bot
├── files/                    # File management
│   ├── route.js             # List files, Upload file
│   ├── [id]/
│   │   └── route.js         # Get, Delete individual file
│   ├── info/
│   │   └── route.js         # File metadata and info
│   └── url/
│       └── route.js         # URL-based file upload
├── vectors/                  # Vector operations
│   ├── route.js             # Vector storage operations
│   ├── [botId]/
│   │   └── route.js         # Bot-specific vector operations
│   └── process/
│       └── [fileId]/
│           └── route.js     # File vectorization processing
├── chat/
│   └── [botId]/
│       └── route.js         # Chat interactions with bots
└── webhooks/
    └── clerk/
        └── route.js         # User lifecycle webhooks
```

### Data Models
```
src/models/
├── User.js                  # User profiles and preferences
├── Bot.js                   # Chatbot configurations
├── File.js                  # Uploaded file metadata
├── Conversation.js          # Chat conversations
├── Message.js               # Individual chat messages
└── Chunk.js                 # Text chunks for RAG
```

### Service Layer
```
src/lib/
├── mongo.js                 # MongoDB connection
├── user.js                  # User management utilities
├── vectorStore.js           # Vector database operations
├── fileProcessor.js         # File processing pipeline
├── loader.js                # Document loaders
├── apiResponse.js           # Standardized API responses
└── api.js                   # API client utilities
```

## ✅ Currently Working Features

### 🔐 Authentication & User Management
- [x] Clerk integration for authentication
- [x] User profile sync between Clerk and MongoDB
- [x] Webhook handling for user lifecycle events
- [x] Role-based access control
- [x] Session management

### 🤖 Bot Management
- [x] **Create bots** with customization options
- [x] **List all user bots** with pagination and filtering
- [x] **Get individual bot details** with analytics
- [x] **Update bot settings** (name, description, status, customization)
- [x] **Delete bots** with complete cleanup
- [x] **Bot status management** (active/inactive)
- [x] **Custom styling** (colors, position, messages)

### 📁 File Management
- [x] **Multi-format file upload** (PDF, DOCX, CSV, TXT, MD, HTML)
- [x] **File validation** (size limits, format checking)
- [x] **File processing pipeline** with status tracking
- [x] **Text extraction** from various formats
- [x] **File metadata storage** and retrieval
- [x] **Delete files** with cleanup
- [x] **File chunking** for vector storage

### 🔍 Vector Storage & Search
- [x] **Dynamic collection creation** per bot
- [x] **OpenAI embeddings** generation (text-embedding-3-large/small)
- [x] **Qdrant vector storage** with metadata
- [x] **Similarity search** for RAG functionality
- [x] **Vector collection management**
- [x] **Embedding caching** and optimization

### 💬 Chat System (Partial)
- [x] **Chat endpoint structure** 
- [x] **Bot-specific chat routing**
- [x] **Message validation**
- [ ] **RAG integration** (in progress)
- [ ] **OpenAI completion** (in progress)

### 📊 Analytics & Monitoring
- [x] **File processing statistics**
- [x] **Bot usage tracking**
- [x] **Vector count monitoring**
- [x] **User limit checking**
- [ ] **Conversation analytics** (planned)

### 🛠️ API Infrastructure
- [x] **Standardized response format**
- [x] **Error handling and validation**
- [x] **Authentication middleware**
- [x] **Request/response logging**
- [x] **API rate limiting foundation**

## 🚧 Upcoming Features

### High Priority (Next 2-4 weeks)
- [ ] **Complete chat functionality** with OpenAI integration
- [ ] **RAG pipeline** integration with vector search
- [ ] **Real-time chat** with WebSocket support
- [ ] **Chat history** storage and retrieval
- [ ] **Conversation management**
- [ ] **Message threading**

### Medium Priority (1-2 months)
- [ ] **Advanced analytics dashboard**
- [ ] **Bot performance metrics**
- [ ] **User engagement tracking**
- [ ] **Custom training data** upload
- [ ] **Bot templates** and presets
- [ ] **Multi-language support**

### Future Enhancements (3-6 months)
- [ ] **API rate limiting** implementation
- [ ] **Caching layer** with Redis
- [ ] **Background job processing**
- [ ] **Email notifications**
- [ ] **Export/import** functionality
- [ ] **Advanced search** capabilities
- [ ] **Integration APIs** (third-party services)
- [ ] **Webhook system** for external integrations

### Enterprise Features (6+ months)
- [ ] **Multi-tenant architecture**
- [ ] **Team collaboration** features
- [ ] **Advanced permissions** system
- [ ] **Audit logging**
- [ ] **Custom model** support
- [ ] **On-premise deployment** options

## 🔌 API Endpoints

### Bot Management
```http
GET    /api/bots              # List user's bots
POST   /api/bots              # Create new bot
GET    /api/bots/[id]         # Get bot details
PATCH  /api/bots/[id]         # Update bot
DELETE /api/bots/[id]         # Delete bot
```

### File Management
```http
GET    /api/files?botId=xxx   # List bot's files
POST   /api/files             # Upload file
GET    /api/files/[id]        # Get file details
DELETE /api/files/[id]        # Delete file
GET    /api/files/info        # File metadata
POST   /api/files/url         # Upload from URL
```

### Vector Operations
```http
GET    /api/vectors           # Vector statistics
GET    /api/vectors/[botId]   # Bot vector stats
POST   /api/vectors/process/[fileId]  # Process file for vectors
```

### Chat
```http
POST   /api/chat/[botId]      # Send message to bot
```

### Webhooks
```http
POST   /api/webhooks/clerk    # Clerk user events
```

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+ 
- MongoDB Atlas or local MongoDB
- Qdrant Cloud or local Qdrant instance
- Clerk account and API keys
- OpenAI API key

### Environment Variables
```env
# Authentication
CLERK_SECRET_KEY=clerk_secret_***
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_***
CLERK_WEBHOOK_SECRET=whsec_***

# Database
MONGODB_URI=mongodb+srv://***

# Vector Database
QDRANT_URL=https://***
QDRANT_API_KEY=***

# AI Services
OPENAI_API_KEY=sk-***

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Installation
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run vector tests
npm run test:vectors
```

## 📡 API Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Paginated Response
```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

## 🔍 Performance Considerations

### Current Optimizations
- MongoDB connection pooling
- Vector store caching
- Lazy loading for non-critical data
- Efficient file processing pipeline

### Planned Optimizations
- Redis caching layer
- Background job processing
- CDN for file storage
- Database indexing improvements

## 🚨 Known Limitations

1. **File Processing**: Limited to 50MB per file
2. **Vector Storage**: No automatic cleanup for orphaned vectors
3. **Chat System**: Basic implementation without advanced features
4. **Rate Limiting**: Not implemented yet
5. **Monitoring**: Limited observability and logging
6. **Error Recovery**: Basic error handling without retry mechanisms

## 🔒 Security Features

### Implemented
- Clerk authentication integration
- Input validation and sanitization
- File type validation
- User data isolation
- CORS configuration

### Planned
- API rate limiting
- Request size limits
- Advanced audit logging
- Encryption at rest
- Security headers

## 📈 Scalability Roadmap

### Current Architecture
- Serverless functions (Vercel/Netlify ready)
- MongoDB Atlas (cloud-native scaling)
- Qdrant Cloud (managed vector DB)

### Future Architecture
- Microservices separation
- Event-driven architecture
- Horizontal scaling capabilities
- Multi-region deployment

---

**Note**: This backend is under active development. API endpoints and data structures may change. Not recommended for production use until v1.0 release.