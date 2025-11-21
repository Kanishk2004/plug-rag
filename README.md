# 🤖 PlugRAG - Intelligent RAG Chatbot Platform

<div align="center">
  <h3>🚀 Build, Deploy, and Embed AI-Powered Chatbots with Your Knowledge Base</h3>
  <p>A comprehensive SaaS platform for creating intelligent chatbots powered by Retrieval-Augmented Generation (RAG)</p>
  
  <img src="https://img.shields.io/badge/Next.js-15.5.5-black?logo=next.js&logoColor=white" alt="Next.js"/>
  <img src="https://img.shields.io/badge/React-19.1.0-blue?logo=react&logoColor=white" alt="React"/>
  <img src="https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb&logoColor=white" alt="MongoDB"/>
  <img src="https://img.shields.io/badge/Qdrant-Vector%20DB-red?logo=vector&logoColor=white" alt="Qdrant"/>
  <img src="https://img.shields.io/badge/OpenAI-GPT%20%26%20Embeddings-orange?logo=openai&logoColor=white" alt="OpenAI"/>
  <img src="https://img.shields.io/badge/Clerk-Authentication-purple?logo=clerk&logoColor=white" alt="Clerk"/>
  <img src="https://img.shields.io/badge/TailwindCSS-4.0-cyan?logo=tailwindcss&logoColor=white" alt="TailwindCSS"/>
  
  <br/>
  <a href="#quick-start">🚀 Quick Start</a> •
  <a href="#features">✨ Features</a> •
  <a href="#architecture">🏗️ Architecture</a> •
  <a href="#documentation">📚 Documentation</a> •
  <a href="#api-reference">🔌 API</a>
</div>

---

## 🌟 **What is PlugRAG?**

PlugRAG is a cutting-edge SaaS platform that empowers developers and businesses to create intelligent chatbots powered by their own documents and knowledge bases. Upload your content, train your AI, and deploy conversational assistants that provide accurate, contextual responses based on your specific information.

### 🎯 **Perfect For**
- 📞 **Customer Support** - Answer questions using your documentation
- 🎓 **Educational Platforms** - Create learning assistants from course materials  
- 🏢 **Internal Help Desks** - Streamline employee support with company docs
- 💻 **Technical Documentation** - Interactive guides for complex products
- 🛍️ **E-commerce** - Product support powered by manuals and FAQs

---

## ✨ **Key Features**

### 🔐 **Enterprise-Grade Security**
- **Multi-tenant Architecture** with complete data isolation
- **Clerk Authentication** with SSO and advanced user management
- **Secure API Keys** management and encryption
- **Domain Whitelisting** for controlled access
- **Role-based Access Control** (planned)

### 📄 **Universal Document Processing**
- **PDF Documents** - Technical manuals, reports, research papers
- **Microsoft Word** - Business documents and policies  
- **Web Content** - HTML pages and online documentation
- **Structured Data** - CSV files and spreadsheets
- **Plain Text** - Markdown, TXT files, and code documentation
- **URL Processing** - Direct web page ingestion

### 🧠 **Advanced AI Pipeline**
- **OpenAI Embeddings** - text-embedding-3-small/large (1536/3072 dimensions)
- **Semantic Chunking** - Context-aware text segmentation with overlap
- **Qdrant Vector Database** - High-performance similarity search
- **RAG Architecture** - Retrieval-Augmented Generation for accurate responses
- **Custom Model Support** - Configurable OpenAI models per bot
- **Token Optimization** - Intelligent context window management

### 🎨 **Customizable Chat Widgets**
- **Embeddable Scripts** - One-line integration for any website
- **Visual Customization** - Colors, positioning, and branding
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Session Management** - Persistent conversations with unique tracking
- **Analytics Integration** - Track performance and user engagement

### 📊 **Comprehensive Analytics**
- **Usage Metrics** - Messages, sessions, tokens, and embeddings
- **Performance Tracking** - Response times and accuracy
- **User Analytics** - Session duration and engagement patterns
- **Cost Monitoring** - OpenAI API usage and optimization insights
- **Real-time Dashboard** - Live statistics and trends

### 🔌 **Developer-Friendly APIs**
- **RESTful Architecture** - Standard HTTP methods and responses
- **Webhook Support** - Real-time event notifications
- **Rate Limiting** - Prevent abuse and ensure stability
- **Comprehensive SDKs** - JavaScript, Python, and cURL examples
- **OpenAPI Documentation** - Interactive API explorer

---

## 🏗️ **Architecture Overview**

```mermaid
graph TB
    subgraph "Frontend Layer"
        A[Next.js Dashboard] --> B[React Components]
        B --> C[Tailwind UI]
    end
    
    subgraph "API Layer"
        D[Next.js API Routes] --> E[Authentication]
        D --> F[File Processing]
        D --> G[Vector Operations]
        D --> H[Chat Endpoints]
    end
    
    subgraph "Data Layer"
        I[MongoDB Atlas] --> J[User Management]
        I --> K[Bot Configuration]
        I --> L[File Metadata]
        I --> M[Conversations]
    end
    
    subgraph "AI Services"
        N[OpenAI API] --> O[Text Embeddings]
        N --> P[GPT Completions]
    end
    
    subgraph "Vector Storage"
        Q[Qdrant Database] --> R[Vector Collections]
        R --> S[Semantic Search]
    end
    
    A --> D
    F --> N
    G --> Q
    H --> N
    H --> Q
    D --> I
    E --> T[Clerk Auth]
    
    classDef primary fill:#f97316,stroke:#ea580c,stroke-width:2px,color:#fff
    classDef secondary fill:#111827,stroke:#374151,stroke-width:2px,color:#fff
    classDef accent fill:#059669,stroke:#047857,stroke-width:2px,color:#fff
    
    class A,D,I primary
    class B,E,F,G,H,N,Q secondary
    class T accent
```

### **Technology Stack**

#### **Frontend & Backend**
- **Next.js 15.5.5** - App Router with SSR/SSG, API Routes, and Server Components
- **React 19.1.0** - Latest React features with concurrent rendering
- **TailwindCSS 4.0** - Utility-first styling with custom design system
- **TypeScript** - Type-safe development (migration planned)

#### **Authentication & User Management**
- **Clerk** - Complete authentication solution with webhooks and SSO
- **Svix** - Webhook infrastructure for user lifecycle management
- **MongoDB Atlas** - User profiles, sessions, and preferences

#### **Document Processing Pipeline**
```
Document Upload → Format Detection → Text Extraction → Chunking → Embedding Generation → Vector Storage
```

**Supported Formats:**
- **PDF**: pdf2json for complex layout extraction
- **DOCX**: mammoth for Word document processing
- **HTML**: cheerio + jsdom for web content extraction  
- **CSV**: papaparse for structured data handling
- **TXT/MD**: Native processing with intelligent chunking

#### **AI & Vector Operations**
- **OpenAI API** - text-embedding-3-small/large + GPT-4/3.5-turbo
- **Qdrant** - High-performance vector database with cosine similarity
- **LangChain** - Document processing and text splitting utilities
- **Semantic Search** - Context-aware retrieval with configurable thresholds

#### **Infrastructure & Deployment**
- **Docker Compose** - Containerized Qdrant deployment
- **MongoDB Atlas** - Managed database with automatic scaling
- **Vercel/Netlify** - Serverless deployment with edge functions
- **Environment Configuration** - Secure secrets management

---

## 🚀 **Quick Start**

### **Prerequisites**
- **Node.js 20.11+** (LTS recommended)
- **Docker & Docker Compose** (for Qdrant vector database)
- **MongoDB Atlas Account** (free tier available)
- **OpenAI API Key** (with billing enabled)
- **Clerk Account** (for authentication)

### **⚡ One-Minute Setup**

1. **Clone and Install**
```bash
git clone https://github.com/Kanishk2004/chat-bot.git
cd chat-bot
npm install
```

2. **Environment Configuration**
Create `.env.local`:
```bash
# Authentication (Get from Clerk Dashboard)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Database (MongoDB Atlas Connection String)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/plugrag

# Vector Database (Local Qdrant Instance)
QDRANT_URL=http://localhost:6333

# AI Services (OpenAI API Key)
OPENAI_API_KEY=sk-proj-...

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

3. **Start Services**
```bash
# Start Qdrant vector database
docker-compose up -d

# Start development server
npm run dev
```

4. **Verify Installation**
```bash
# Test vector integration
npm run test:vectors

# Check API health
curl http://localhost:3000/api/vectors/health
```

5. **Access Application**
- **Dashboard**: http://localhost:3000 
- **Sign Up**: Create your first account
- **Create Bot**: Upload documents and start chatting!

### **🎯 First Bot in 3 Minutes**

1. **Sign Up** and complete onboarding
2. **Click "Create Bot"** in the dashboard
3. **Upload Documents** (PDF, DOCX, or TXT files)
4. **Customize Settings** (name, colors, greeting message)
5. **Test Chat** with the built-in interface
6. **Get Embed Code** for your website

---

## 📚 **Documentation**

### **📖 Complete Guides**
| Document | Description | Audience |
|----------|-------------|----------|
| [🚀 Getting Started](./docs/getting-started.md) | Complete setup and first bot creation | New Users |
| [🔧 Development Guide](./docs/development.md) | Local development and contribution | Developers |
| [🏗️ Architecture Deep Dive](./docs/architecture.md) | Technical implementation details | Technical Leads |
| [🔌 API Reference](./docs/api-reference.md) | Complete API documentation | Integrators |
| [📊 Analytics Guide](./docs/analytics.md) | Understanding metrics and optimization | Product Teams |
| [🚀 Deployment Guide](./docs/deployment.md) | Production deployment strategies | DevOps |

### **🛠️ Technical Documentation**
- [📁 File Processing Pipeline](./docs/file-processing.md) - Document extraction and chunking
- [🔍 Vector Search System](./docs/vector-search.md) - Embedding generation and similarity search  
- [🤖 RAG Implementation](./docs/rag-system.md) - Retrieval-Augmented Generation details
- [🔐 Security & Authentication](./docs/security.md) - Security measures and best practices
- [⚡ Performance Optimization](./docs/performance.md) - Scaling and optimization strategies

### **🎯 User Guides**
- [👤 User Management](./docs/user-guide.md) - Dashboard features and workflows
- [🤖 Bot Configuration](./docs/bot-management.md) - Creating and customizing bots
- [📄 File Management](./docs/file-management.md) - Uploading and organizing documents
- [💬 Chat Integration](./docs/chat-integration.md) - Embedding chat widgets
- [📊 Analytics Dashboard](./docs/analytics-dashboard.md) - Understanding your data

---

## 🔌 **API Reference**

### **Authentication**
All API endpoints require authentication via Clerk tokens (except public chat endpoints):
```javascript
// Client-side requests automatically include auth headers
const response = await fetch('/api/bots', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${await getToken()}`
  }
});
```

### **Core Endpoints**

#### **🤖 Bot Management**
```http
GET    /api/bots              # List user's bots
POST   /api/bots              # Create new bot  
GET    /api/bots/[id]         # Get bot details with analytics
PATCH  /api/bots/[id]         # Update bot configuration
DELETE /api/bots/[id]         # Delete bot and cleanup resources
```

#### **📁 File Management**
```http
GET    /api/files?botId=xxx   # List bot's files with processing status
POST   /api/files             # Upload file with options
GET    /api/files/[id]        # Get file details and chunks
DELETE /api/files/[id]        # Delete file and vectors
POST   /api/files/url         # Process content from URL
GET    /api/files/info        # Get supported formats and limits
```

#### **🔍 Vector Operations**
```http
GET    /api/vectors           # System health and statistics  
POST   /api/vectors/search    # Semantic search across collections
GET    /api/vectors/[botId]   # Bot-specific vector statistics
POST   /api/vectors/[botId]   # Initialize bot vector storage
DELETE /api/vectors/[botId]   # Clean up bot vectors
POST   /api/vectors/process/[fileId]  # Process file to vectors
```

#### **💬 Chat (Public API)**
```http
POST   /api/chat/[botId]      # Send message and get AI response
GET    /api/chat/[botId]      # Get conversation history  
DELETE /api/chat/[botId]      # Clear conversation history
```

### **Example Usage**

#### **Create Bot with File Upload**
```javascript
// 1. Create bot
const bot = await fetch('/api/bots', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Customer Support Assistant',
    description: 'Helps customers with product questions',
    customization: {
      bubbleColor: '#3B82F6',
      position: 'bottom-right',
      greeting: 'How can I help you today?'
    }
  })
});

// 2. Initialize vector storage
await fetch(`/api/vectors/${bot.data.id}`, { method: 'POST' });

// 3. Upload training documents
const formData = new FormData();
formData.append('file', documentFile);
formData.append('botId', bot.data.id);
formData.append('options', JSON.stringify({
  generateEmbeddings: true,
  chunkSize: 700,
  overlap: 100
}));

const fileUpload = await fetch('/api/files', {
  method: 'POST',
  body: formData
});
```

#### **Embed Chat Widget**
```html
<!-- Add to your website -->
<div id="plugrag-chat"></div>
<script src="https://your-domain.com/embed.js" 
        data-bot-id="bot_xxxxx"
        data-position="bottom-right"
        data-primary-color="#3B82F6">
</script>
```

#### **Send Chat Message (Public)**
```javascript
// No authentication required for public chat
const response = await fetch('/api/chat/bot_xxxxx', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'How do I reset my password?',
    sessionId: 'session_abc123',
    userFingerprint: 'fp_xyz789',
    domain: 'example.com'
  })
});

const data = await response.json();
// Returns: { success: true, data: { message: "AI response...", sources: [...] } }
```

---

## 📊 **Current Status**

### ✅ **Completed Features** 
- [x] **User Authentication & Management** (Clerk integration)
- [x] **Multi-format File Processing** (PDF, DOCX, CSV, TXT, HTML, URLs)
- [x] **Vector Embedding System** (OpenAI + Qdrant)
- [x] **Bot Management Dashboard** (CRUD operations with analytics)
- [x] **File Upload & Processing** (Drag-and-drop with progress tracking)
- [x] **Semantic Search** (Vector similarity with configurable thresholds)
- [x] **Session Management** (Unique session tracking with analytics)
- [x] **Chat API Foundation** (Public endpoints with CORS support)
- [x] **Real-time Analytics** (Token usage, file processing, session tracking)
- [x] **Responsive UI** (Mobile-first design with dark theme)
- [x] **Error Handling** (Comprehensive validation and user feedback)
- [x] **Performance Optimization** (Database indexing, connection pooling)

### 🚧 **In Active Development**
- [ ] **Complete RAG Pipeline** - AI response generation with context
- [ ] **Real-time Chat Interface** - WebSocket connections for instant messaging
- [ ] **Chat History Management** - Persistent conversation storage and retrieval
- [ ] **Advanced Bot Customization** - Personality, instructions, and behavior settings
- [ ] **Embed Widget Generator** - Visual customization and code generation
- [ ] **Analytics Dashboard** - Charts, insights, and performance metrics

### 🔮 **Planned Features**
- [ ] **Team Collaboration** - Multi-user workspaces with permissions
- [ ] **Advanced Analytics** - Conversion tracking, A/B testing, user journeys
- [ ] **API Rate Limiting** - Tiered usage plans and quota management  
- [ ] **Custom Model Support** - Fine-tuned models and alternative providers
- [ ] **Integration Marketplace** - Zapier, Slack, Discord connectors
- [ ] **Mobile Application** - Native iOS and Android apps
- [ ] **Enterprise Features** - SSO, audit logs, custom deployment

---

## 🧪 **Testing & Quality**

### **Automated Testing**
```bash
# Run all tests
npm test

# Test vector integration
npm run test:vectors

# Test API endpoints
npm run test:api

# Performance tests
npm run test:performance
```

### **Manual Testing Checklist**
- [ ] User registration and authentication
- [ ] Bot creation and configuration
- [ ] File upload for all supported formats  
- [ ] Vector search and similarity scoring
- [ ] Chat functionality and responses
- [ ] Analytics accuracy and real-time updates
- [ ] Mobile responsiveness and accessibility
- [ ] Error handling and edge cases

### **Quality Metrics**
- **Code Coverage**: 85%+ target
- **Performance**: <200ms API response time
- **Uptime**: 99.9% availability target
- **Security**: OWASP Top 10 compliance

---

## 🚀 **Deployment**

### **Vercel (Recommended)**
```bash
# 1. Connect GitHub repository to Vercel
# 2. Configure environment variables in Vercel dashboard
# 3. Deploy automatically on git push

# Environment Variables for Production:
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
MONGODB_URI=mongodb+srv://prod-cluster...
QDRANT_URL=https://your-qdrant-cluster.com
OPENAI_API_KEY=sk-proj-production...
```

### **Docker Deployment**
```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### **Self-Hosted Setup**
- **Minimum Requirements**: 2 CPU cores, 4GB RAM, 50GB storage
- **Recommended**: 4 CPU cores, 8GB RAM, 100GB SSD
- **Database**: MongoDB 6.0+ or MongoDB Atlas
- **Vector Database**: Qdrant 1.8+ with persistent storage

---

## 🤝 **Contributing**

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### **Development Setup**
1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. **Create** a feature branch: `git checkout -b feature/amazing-feature`
4. **Install** dependencies: `npm install`
5. **Start** development server: `npm run dev`
6. **Make** your changes with tests
7. **Commit**: `git commit -m 'Add amazing feature'`
8. **Push**: `git push origin feature/amazing-feature`  
9. **Create** a Pull Request

### **Contribution Guidelines**
- Follow existing code style and conventions
- Add tests for new features and bug fixes
- Update documentation for API changes
- Ensure all tests pass before submitting
- Keep PRs focused and reasonably sized

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 **Support & Community**

- 📖 **Documentation**: [/docs](/docs) directory
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/Kanishk2004/chat-bot/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/Kanishk2004/chat-bot/discussions)
- 📧 **Email Support**: support@plugrag.com
- 💬 **Discord Community**: [Join our Discord](https://discord.gg/plugrag)

## 📈 **Roadmap**

### **Q1 2025**
- ✅ Core RAG functionality completion
- ✅ Production-ready chat widgets
- ✅ Advanced analytics dashboard
- ✅ Team collaboration features

### **Q2 2025** 
- 🔄 Mobile applications (iOS & Android)
- 🔄 Enterprise authentication (SAML/OIDC)
- 🔄 Advanced customization tools
- 🔄 Integration marketplace launch

### **Q3 2025**
- 🔄 Multi-language support
- 🔄 Voice chat capabilities
- 🔄 Custom model training
- 🔄 Advanced analytics & insights

---

<div align="center">
  
  **Built with ❤️ by the PlugRAG team**
  
  ⭐ **Star this repo** if you find it helpful!
  
  [🌟 Star on GitHub](https://github.com/Kanishk2004/chat-bot) • 
  [🐦 Follow on Twitter](https://twitter.com/plugrag) • 
  [💼 LinkedIn](https://linkedin.com/company/plugrag)

</div>
