# 🤖 PlugRAG - Intelligent RAG Chatbot Platform

<div align="center">
  
  ![PlugRAG Logo](https://img.shields.io/badge/PlugRAG-AI%20Chatbot%20Platform-orange?style=for-the-badge)
  
  ### 🚀 Build, Deploy, and Embed AI-Powered Chatbots with Your Knowledge Base
  
  **A production-ready SaaS platform for creating intelligent chatbots powered by Retrieval-Augmented Generation (RAG)**
  
  [![Next.js](https://img.shields.io/badge/Next.js-16.1.1-black?logo=next.js&logoColor=white)](https://nextjs.org/)
  [![React](https://img.shields.io/badge/React-19.1.0-blue?logo=react&logoColor=white)](https://react.dev/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![Qdrant](https://img.shields.io/badge/Qdrant-Vector%20DB-red)](https://qdrant.tech/)
  [![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4-orange?logo=openai&logoColor=white)](https://openai.com/)
  [![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker&logoColor=white)](https://www.docker.com/)
  
  [📚 Documentation](#documentation) • [🚀 Quick Start](#quick-start) • [✨ Features](#features) • [🏗️ Architecture](#architecture) • [🔌 API Reference](docs/API-REFERENCE.md)
  
</div>

---

## 📖 Table of Contents

- [What is PlugRAG?](#what-is-plugrag)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Documentation](#documentation)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)
- [License](#license)

---

## 🌟 What is PlugRAG?

**PlugRAG** is a cutting-edge SaaS platform that empowers developers and businesses to create intelligent chatbots powered by their own documents and knowledge bases. Upload your content, train your AI, and deploy conversational assistants that provide accurate, contextual responses based on your specific information.

### 🎯 Perfect For

- 📞 **Customer Support** - Answer customer questions using your product documentation
- 🎓 **Educational Platforms** - Create learning assistants from course materials and textbooks
- 🏢 **Internal Help Desks** - Streamline employee support with company policies and procedures
- 💻 **Technical Documentation** - Interactive guides for complex products and APIs
- 🛍️ **E-commerce** - Product support powered by manuals, FAQs, and guides
- 📋 **Knowledge Management** - Make organizational knowledge instantly accessible

### 🔥 Why PlugRAG?

- ✅ **Production-Ready** - Built with enterprise-grade security and scalability
- ✅ **No AI Expertise Required** - Simple interface for non-technical users
- ✅ **Full Data Control** - Your data stays in your infrastructure
- ✅ **Embeddable** - One-line integration for any website
- ✅ **Cost-Effective** - Pay only for what you use with OpenAI
- ✅ **Open Source** - Self-host or extend as needed

---

## ✨ Key Features

### 🔐 Enterprise-Grade Security

- **Multi-tenant Architecture** with complete data isolation
- **Clerk Authentication** with SSO, MFA, and advanced user management
- **API Key Encryption** using AES-256-CBC with HMAC-SHA256
- **Domain Whitelisting** for controlled chatbot access
- **Rate Limiting** to prevent abuse and control costs
- **Input Sanitization** to prevent NoSQL injection attacks

### 📄 Universal Document Processing

- **PDF Documents** - Technical manuals, reports, research papers
- **Microsoft Word (.docx)** - Business documents and policies
- **Web Content (HTML)** - Online documentation and articles
- **Text Files (.txt, .md)** - Plain text and Markdown files
- **CSV Files** - Structured data and spreadsheets
- **Batch Processing** - Upload multiple files simultaneously
- **Background Processing** - BullMQ job queue with Redis

### 🤖 Advanced RAG Capabilities

- **Semantic Search** - Vector similarity using Qdrant database
- **Context-Aware Responses** - GPT-4 powered conversations
- **Intent Classification** - Smart FAQ matching and routing
- **Conversation Memory** - Multi-turn dialogue support
- **Custom Embeddings** - OpenAI text-embedding-3-small (1536 dimensions)
- **Intelligent Chunking** - Optimized text splitting for better retrieval

### 💬 Embeddable Chat Widget

- **One-Line Integration** - Simple JavaScript snippet
- **Customizable UI** - Match your brand colors and style
- **Responsive Design** - Works on desktop and mobile
- **Session Management** - Persistent conversations across page loads
- **User Fingerprinting** - Privacy-safe user tracking
- **Domain Analytics** - Track usage by website

### 📊 Analytics & Monitoring

- **Real-Time Metrics** - Message counts, active users, response times
- **Conversation History** - Full audit trail of all interactions
- **Performance Tracking** - Monitor bot accuracy and user satisfaction
- **Domain Breakdown** - See which websites generate most traffic
- **Cost Monitoring** - Track OpenAI API usage per bot

### 🎨 Modern Dashboard

- **Bot Management** - Create, configure, and monitor bots
- **File Management** - Upload, view, and delete knowledge base documents
- **API Key Management** - Bring your own OpenAI key or use fallback
- **Settings & Configuration** - Customize bot behavior and appearance
- **User-Friendly Interface** - Built with React 19 and Tailwind CSS 4

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 16.1.1** - React framework with App Router
- **React 19.1.0** - UI components with latest features
- **Tailwind CSS 4** - Utility-first styling
- **Clerk** - Authentication and user management

### Backend
- **Next.js API Routes** - Serverless API endpoints
- **Node.js 20+** - JavaScript runtime
- **Mongoose** - MongoDB ODM
- **BullMQ** - Job queue for background processing

### Databases
- **MongoDB Atlas** - Primary database for bots, users, files
- **Qdrant** - Vector database for embeddings (1536D)
- **Redis** - Job queue and caching

### AI & ML
- **OpenAI GPT-4** - Chat completions
- **OpenAI Embeddings** - text-embedding-3-small
- **LangChain** - Document processing and RAG pipeline
- **Tiktoken** - Token counting and optimization

### Storage & Processing
- **AWS S3** - File storage with presigned URLs
- **Mammoth** - DOCX text extraction
- **PDF2JSON** - PDF parsing
- **PapaParse** - CSV processing

### DevOps
- **Docker & Docker Compose** - Containerization
- **ESLint** - Code linting
- **Git** - Version control

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20.11 or higher
- **Docker Desktop** (for local development)
- **MongoDB Atlas** account (free tier available)
- **OpenAI API** key
- **Clerk** account for authentication
- **AWS S3** bucket for file storage

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/plugrag.git
   cd plugrag
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your credentials:
   ```env
   # MongoDB
   MONGODB_URI=mongodb+srv://your-cluster.mongodb.net/plugrag
   
   # Clerk Authentication
   CLERK_SECRET_KEY=sk_live_...
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   CLERK_WEBHOOK_SECRET=whsec_...
   
   # Encryption (32 characters)
   ENCRYPTION_SECRET_KEY=your-32-character-secret-key!!
   
   # OpenAI
   OPENAI_API_KEY=sk-...
   
   # AWS S3
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=your-bucket-name
   
   # Redis (for Docker)
   REDIS_HOST=localhost
   REDIS_PORT=6379
   
   # Qdrant (for Docker)
   QDRANT_URL=http://localhost:6333
   ```

4. **Start local services (Redis & Qdrant)**
   ```bash
   docker-compose up redis qdrant -d
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Start the worker process (in another terminal)**
   ```bash
   npm run worker
   ```

7. **Open your browser**
   ```
   http://localhost:3000
   ```

### Docker Deployment

For full Docker deployment (all services):

```bash
# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f
```

See [DOCKER.md](DOCKER.md) for comprehensive Docker documentation.

---

## 🏗️ Architecture

PlugRAG follows a modern serverless architecture with clear separation of concerns:

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

### Key Components

1. **Frontend (Next.js App Router)**
   - Server-side rendering for SEO
   - Client components for interactivity
   - Tailwind CSS for styling

2. **API Routes (Serverless)**
   - RESTful endpoints
   - Clerk authentication middleware
   - Rate limiting and sanitization

3. **Service Layer**
   - Business logic separation
   - Reusable services
   - Error handling

4. **Background Workers**
   - Asynchronous file processing
   - Vector embedding generation
   - Queue-based architecture

5. **Data Persistence**
   - MongoDB for structured data
   - Qdrant for vector search
   - S3 for file storage
   - Redis for job queues

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

---

## 📚 Documentation

- **[Getting Started Guide](docs/GETTING-STARTED.md)** - Step-by-step tutorial for beginners
- **[Architecture Overview](docs/ARCHITECTURE.md)** - System design and data flow
- **[API Reference](docs/API-REFERENCE.md)** - Complete API documentation
- **[Docker Deployment](DOCKER.md)** - Container deployment guide
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute to the project

---

## 📁 Project Structure

```
plugRag/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API routes
│   │   │   ├── bots/                 # Bot management endpoints
│   │   │   ├── files/                # File management endpoints
│   │   │   ├── chat/                 # Chat endpoints
│   │   │   ├── health/               # Health check
│   │   │   └── webhooks/             # Clerk webhooks
│   │   ├── dashboard/                # Protected dashboard pages
│   │   └── page.js                   # Landing page
│   ├── components/                   # React components
│   │   ├── dashboard/                # Dashboard-specific components
│   │   ├── conversations/            # Chat UI components
│   │   ├── files/                    # File management components
│   │   └── ui/                       # Reusable UI components
│   ├── lib/                          # Core libraries
│   │   ├── core/                     # Business logic services
│   │   │   ├── chatService.js        # Chat and conversation logic
│   │   │   ├── ragService.js         # RAG pipeline
│   │   │   ├── fileService.js        # File operations
│   │   │   ├── apiKeyService.js      # API key management
│   │   │   ├── faqService.js         # FAQ matching
│   │   │   └── intentClassifier.js   # Intent classification
│   │   ├── integrations/             # External service integrations
│   │   │   ├── openai.js             # OpenAI client
│   │   │   ├── qdrant.js             # Qdrant vector DB
│   │   │   ├── mongo.js              # MongoDB connection
│   │   │   ├── s3.js                 # AWS S3 client
│   │   │   └── clerk.js              # Clerk auth
│   │   ├── processors/               # Data processing
│   │   │   ├── textExtractor.js      # File text extraction
│   │   │   ├── chunker.js            # Text chunking
│   │   │   └── validator.js          # Input validation
│   │   ├── queues/                   # Background job processing
│   │   │   ├── config.js             # Queue configuration
│   │   │   ├── fileProcessingQueue.js# File processing queue
│   │   │   ├── worker.js             # Worker process
│   │   │   └── processors/           # Job processors
│   │   └── utils/                    # Utility functions
│   │       ├── apiResponse.js        # Standard API responses
│   │       ├── encryption.js         # AES-256 encryption
│   │       ├── rateLimit.js          # Rate limiting
│   │       ├── sanitization.js       # Input sanitization
│   │       ├── logger.js             # Logging utility
│   │       └── envConfig.js          # Environment validation
│   ├── models/                       # MongoDB schemas
│   │   ├── Bot.js                    # Bot model
│   │   ├── User.js                   # User model
│   │   ├── File.js                   # File model
│   │   └── Conversation.js           # Conversation model
│   └── hooks/                        # Custom React hooks
│       ├── useBots.js                # Bot management hook
│       ├── useBot.js                 # Single bot hook
│       ├── useBotFiles.js            # Bot files hook
│       └── useConversations.js       # Conversations hook
├── public/                           # Static assets
│   ├── embed.js                      # Chat widget embed script
│   └── embed-test.html               # Widget test page
├── docs/                             # Documentation
│   ├── GETTING-STARTED.md            # Beginner guide
│   ├── ARCHITECTURE.md               # System architecture
│   ├── API-REFERENCE.md              # API documentation
│   └── DEPLOYMENT.md                 # Deployment guide
├── docker-compose.yaml               # Docker Compose configuration
├── Dockerfile                        # Main app Dockerfile
├── Dockerfile.worker                 # Worker Dockerfile
├── .dockerignore                     # Docker ignore file
├── start-worker.js                   # Worker entry point
├── package.json                      # Dependencies
├── next.config.mjs                   # Next.js configuration
├── tailwind.config.js                # Tailwind configuration
├── .env.example                      # Environment template
└── README.md                         # This file
```

---

## 🔑 Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://...` |
| `CLERK_SECRET_KEY` | Clerk authentication secret | `sk_live_...` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | `pk_live_...` |
| `ENCRYPTION_SECRET_KEY` | 32-character encryption key (AES-256) | `abcd1234...` (32 chars) |
| `OPENAI_API_KEY` | OpenAI API key (fallback) | `sk-...` |
| `AWS_ACCESS_KEY_ID` | AWS access key for S3 | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `...` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `AWS_S3_BUCKET` | S3 bucket name | `my-bucket` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `QDRANT_URL` | Qdrant vector DB URL | `http://localhost:6333` |
| `NEXT_PUBLIC_APP_URL` | Public application URL | `http://localhost:3000` |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signature secret | _(optional)_ |
| `NODE_ENV` | Environment mode | `development` |

See [.env.example](.env.example) for a complete template.

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run linting (`npm run lint`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Style

- Use ESLint configuration provided
- Follow Next.js best practices
- Write meaningful commit messages
- Add comments for complex logic
- Update documentation as needed

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **OpenAI** for GPT-4 and embeddings API
- **Qdrant** for the excellent vector database
- **Clerk** for authentication infrastructure
- **Vercel** for Next.js framework
- **MongoDB** for the database platform
- All open-source contributors

---

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/yourusername/plugrag/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/plugrag/discussions)

---

## 🗺️ Roadmap

### v1.1 (Q1 2026)
- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] Conversation export (CSV/JSON)
- [ ] Custom bot personas
- [ ] Webhook integrations

### v1.2 (Q2 2026)
- [ ] Voice input/output
- [ ] Mobile apps (iOS/Android)
- [ ] Team collaboration features
- [ ] Advanced RAG techniques (HyDE, reranking)
- [ ] Integration marketplace

### v2.0 (Q3 2026)
- [ ] Multi-modal support (images, audio)
- [ ] Fine-tuning capabilities
- [ ] White-label solutions
- [ ] Enterprise SSO
- [ ] On-premise deployment option

---

<div align="center">
  
  **Made with ❤️ by the PlugRAG Team**
  
  [⭐ Star us on GitHub](https://github.com/yourusername/plugrag) • [🐛 Report Bug](https://github.com/yourusername/plugrag/issues) • [💡 Request Feature](https://github.com/yourusername/plugrag/issues)
  
</div>
