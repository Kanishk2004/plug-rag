# PlugRAG - Plug-and-Play RAG Chatbot SaaS Platform

<div align="center">
  <h3>🤖 Build, Deploy, and Embed AI Chatbots with Your Own Knowledge Base</h3>
  <p>A complete RAG (Retrieval-Augmented Generation) chatbot platform built with Next.js, MongoDB, Qdrant, and OpenAI</p>
</div>

---

## 🚀 **What is PlugRAG?**

PlugRAG is a comprehensive SaaS platform that enables developers to create intelligent chatbots powered by their own documents and knowledge bases. Users can upload various file types, and the system automatically processes them into a searchable knowledge base that powers contextual AI responses.

### ✨ **Key Features**

- 🔐 **Multi-tenant Architecture**: Each user gets isolated bots with secure data separation
- 📄 **Universal File Processing**: Support for PDF, DOCX, TXT, CSV, HTML, and web URLs
- 🧠 **Advanced RAG Pipeline**: OpenAI embeddings + Qdrant vector database for semantic search
- 🎨 **Customizable Chat Widgets**: Embeddable scripts with custom styling and behavior
- 📊 **Analytics & Monitoring**: Comprehensive usage tracking and performance metrics
- 🔌 **RESTful APIs**: Complete API suite for integration and automation

## 🏗️ **Architecture Overview**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js App   │    │   MongoDB Atlas  │    │   Qdrant DB     │
│                 │    │                  │    │                 │
│ • Authentication│◄──►│ • User Data      │    │ • Vector Store  │
│ • File Upload   │    │ • Bot Config     │◄──►│ • Embeddings    │
│ • Chat Interface│    │ • File Metadata  │    │ • Semantic Search│
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         └────────────┬───────────────────────┬────────────┘
                      │                       │
                ┌─────▼──────┐          ┌─────▼──────┐
                │ OpenAI API │          │ Clerk Auth │
                │            │          │            │
                │ • Embeddings│          │ • User Mgmt│
                │ • Chat GPT  │          │ • Sessions │
                └────────────┘          └────────────┘
```

## 🛠️ **Tech Stack**

### **Frontend & Backend**
- **Next.js 15.5.5** - App Router, API Routes, Server Components
- **React 19** - UI Components and Interactions
- **TailwindCSS 4** - Styling and Design System

### **Authentication & User Management**
- **Clerk** - Complete authentication solution with webhooks
- **MongoDB Atlas** - User data and session management

### **Document Processing**
- **PDF**: pdf-parse for text extraction
- **DOCX**: mammoth for Word document processing  
- **HTML**: cheerio + jsdom for web content extraction
- **CSV**: papaparse for structured data processing
- **TXT**: Native text processing with smart chunking

### **AI & Vector Storage**
- **OpenAI** - text-embedding-3-small (1536 dimensions) + GPT for responses
- **Qdrant** - High-performance vector database with cosine similarity
- **Semantic Chunking** - Context-aware text segmentation

### **Infrastructure & Deployment**
- **Docker** - Containerized Qdrant deployment
- **MongoDB Atlas** - Cloud database with connection pooling
- **Vercel** - Recommended deployment platform

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 20.11+ 
- Docker (for Qdrant)
- MongoDB Atlas account
- OpenAI API key
- Clerk account

### **Installation**

1. **Clone and Install**
```bash
git clone <repository-url>
cd chat-bot
npm install
```

2. **Environment Setup**
Create `.env.local`:
```bash
# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Database
MONGODB_URI=mongodb+srv://...

# Vector Database
QDRANT_URL=http://localhost:6333

# AI Services
OPENAI_API_KEY=sk-proj-...
```

3. **Start Services**
```bash
# Start Qdrant vector database
docker-compose up -d

# Start development server
npm run dev
```

4. **Verify Setup**
```bash
# Run integration tests
node test/simple-vector-test.js
```

Visit `http://localhost:3000` - Your PlugRAG platform is ready! 🎉

## 📖 **Documentation**

| Document | Description |
|----------|-------------|
| [API Documentation](./docs/api-reference.md) | Complete API endpoints and usage examples |
| [Vector Integration](./docs/vector-integration.md) | Semantic search and embedding system |
| [Development Guide](./docs/development.md) | Setup, testing, and contribution guidelines |

## 🔧 **Core Features**

### **1. Multi-Format File Processing**
Upload and process various file types with automatic text extraction and intelligent chunking:

```javascript
const formData = new FormData();
formData.append('file', file);
formData.append('botId', botId);
formData.append('options', JSON.stringify({
  generateEmbeddings: true,
  maxChunkSize: 700,
  overlap: 100
}));

const result = await fetch('/api/files', {
  method: 'POST',
  body: formData,
});
```

### **2. Semantic Search**
Find relevant content using natural language queries:

```javascript
const results = await fetch('/api/vectors/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    botId: 'your-bot-id',
    query: 'How do I configure authentication?',
    limit: 5,
    scoreThreshold: 0.7
  })
});
```

### **3. Bot Management**
Complete lifecycle management for chatbots:

```javascript
// Create bot with vector storage
const bot = await fetch('/api/bots', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Support Assistant',
    description: 'Customer support chatbot'
  })
});

// Initialize vector storage
await fetch(`/api/vectors/${bot.id}`, { method: 'POST' });
```

## 📊 **Current Status**

### ✅ **Completed Features**
- [x] User authentication and management (Clerk)
- [x] Multi-format file processing (PDF, DOCX, TXT, CSV, HTML)
- [x] Vector embedding generation (OpenAI)
- [x] Semantic search (Qdrant)
- [x] Bot isolation and security
- [x] RESTful API endpoints
- [x] Performance monitoring
- [x] Comprehensive error handling

### 🚧 **In Development**
- [ ] Chat interface components
- [ ] RAG response generation
- [ ] Embeddable chat widgets
- [ ] Analytics dashboard
- [ ] Conversation management
- [ ] Advanced customization options

### 🔮 **Planned Features**
- [ ] Real-time collaboration
- [ ] Advanced analytics
- [ ] Multi-language support
- [ ] Enterprise features
- [ ] Marketplace integrations

## 🧪 **Testing**

Run the comprehensive test suite:

```bash
# Test vector integration
node test/simple-vector-test.js

# Test API endpoints (requires running server)
npm run dev
curl http://localhost:3000/api/vectors/health
```

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 **Support**

- 📖 [Documentation](./docs/)
- 🐛 [Issue Tracker](https://github.com/Kanishk2004/chat-bot/issues)
- 💬 [Discussions](https://github.com/Kanishk2004/chat-bot/discussions)

---

<div align="center">
  <p>Built with ❤️ by the PlugRAG team</p>
  <p>⭐ Star this repo if you find it helpful!</p>
</div>
