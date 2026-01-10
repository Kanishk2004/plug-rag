# 📚 PlugRAG Documentation

Complete documentation for the PlugRAG AI chatbot platform.

## 📖 Documentation Structure

### Getting Started
- **[Getting Started Guide](GETTING-STARTED.md)** - Complete tutorial for beginners
  - Installation and setup
  - Creating your first bot
  - Uploading documents
  - Embedding the chat widget

### Core Documentation
- **[Architecture Overview](ARCHITECTURE.md)** - System design and technical details
  - High-level architecture
  - Data flow
  - Technology stack
  - Core components
  - Database schema

- **[API Reference](API-REFERENCE.md)** - Complete API documentation
  - Authentication
  - Bot management endpoints
  - File management endpoints
  - Chat API
  - Error handling

### Deployment & Operations
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment instructions
  - Vercel deployment
  - Docker deployment
  - AWS deployment
  - Environment configuration
  - Database setup
  - Security checklist

- **[Docker Guide](../DOCKER.md)** - Container deployment
  - Docker setup
  - Docker Compose configuration
  - Production deployment
  - Scaling and monitoring

### Contributing
- **[Contributing Guide](../CONTRIBUTING.md)** - How to contribute
  - Development setup
  - Code style guidelines
  - Submitting changes
  - Bug reports and feature requests

---

## 🚀 Quick Links

### For Users
1. [Install PlugRAG](GETTING-STARTED.md#installation)
2. [Create Your First Bot](GETTING-STARTED.md#your-first-bot)
3. [Upload Documents](GETTING-STARTED.md#upload-documents)
4. [Embed Chat Widget](GETTING-STARTED.md#embed-on-website)

### For Developers
1. [Architecture Overview](ARCHITECTURE.md)
2. [API Documentation](API-REFERENCE.md)
3. [Contributing Guide](../CONTRIBUTING.md)
4. [Development Setup](GETTING-STARTED.md#installation)

### For DevOps
1. [Deployment Guide](DEPLOYMENT.md)
2. [Docker Guide](../DOCKER.md)
3. [Environment Variables](DEPLOYMENT.md#environment-configuration)
4. [Security Checklist](DEPLOYMENT.md#security-checklist)

---

## 📋 Documentation Overview

| Document | Description | Audience |
|----------|-------------|----------|
| [GETTING-STARTED.md](GETTING-STARTED.md) | Step-by-step tutorial | Beginners |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design and components | Developers |
| [API-REFERENCE.md](API-REFERENCE.md) | Complete API documentation | Developers, Integrators |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production deployment | DevOps, Admins |
| [DOCKER.md](../DOCKER.md) | Container deployment | DevOps |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Contribution guidelines | Contributors |
| [README.md](../README.md) | Project overview | Everyone |

---

## 🎯 Quick Reference

### Key Concepts

**Bot** - An AI chatbot instance with its own configuration, knowledge base, and embedding

**RAG (Retrieval-Augmented Generation)** - Technique that combines document retrieval with LLM generation

**Vector Database** - Qdrant database storing document embeddings for semantic search

**Session** - A conversation session between a user and the bot

**Embedding** - Vector representation of text for semantic similarity

### File Support

| Format | Extension | Use Case |
|--------|-----------|----------|
| PDF | `.pdf` | Manuals, reports, guides |
| Word | `.docx` | Business documents, policies |
| Text | `.txt`, `.md` | Documentation, notes |
| CSV | `.csv` | Structured data, FAQs |
| HTML | `.html` | Web content |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/bots` | GET, POST | List/create bots |
| `/api/bots/[id]` | GET, PATCH, DELETE | Manage bot |
| `/api/files` | GET, POST | List/upload files |
| `/api/chat/[botId]` | POST | Send message |
| `/api/health` | GET | Health check |

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGODB_URI` | ✅ | Database connection |
| `CLERK_SECRET_KEY` | ✅ | Authentication |
| `OPENAI_API_KEY` | ✅ | AI/ML services |
| `AWS_ACCESS_KEY_ID` | ✅ | File storage |
| `ENCRYPTION_SECRET_KEY` | ✅ | API key encryption |
| `REDIS_HOST` | ✅ | Job queue |
| `QDRANT_URL` | ✅ | Vector database |

---

## 🔍 Search Documentation

### Find by Topic

**Authentication & Security:**
- [Clerk Setup](GETTING-STARTED.md#step-4-set-up-clerk-authentication)
- [API Key Encryption](ARCHITECTURE.md#security-architecture)
- [Security Checklist](DEPLOYMENT.md#security-checklist)

**File Processing:**
- [Upload Files](GETTING-STARTED.md#upload-documents)
- [Supported Formats](GETTING-STARTED.md#step-1-prepare-documents)
- [Background Processing](ARCHITECTURE.md#background-processing-layer)

**Chat & RAG:**
- [Chat API](API-REFERENCE.md#chat-api)
- [RAG Pipeline](ARCHITECTURE.md#chat-message-flow)
- [Intent Classification](ARCHITECTURE.md#intent-classifier-intentclassifierjs)

**Deployment:**
- [Vercel Deployment](DEPLOYMENT.md#vercel-deployment)
- [Docker Deployment](DOCKER.md)
- [AWS Deployment](DEPLOYMENT.md#aws-deployment)

**Development:**
- [Project Structure](../README.md#project-structure)
- [Code Style](CONTRIBUTING.md#code-style-guidelines)
- [Git Workflow](CONTRIBUTING.md#development-workflow)

---

## ❓ FAQ

**Q: Where do I start?**  
A: Begin with [Getting Started Guide](GETTING-STARTED.md)

**Q: How do I deploy to production?**  
A: See [Deployment Guide](DEPLOYMENT.md)

**Q: What's the architecture?**  
A: See [Architecture Overview](ARCHITECTURE.md)

**Q: How do I use the API?**  
A: See [API Reference](API-REFERENCE.md)

**Q: Can I contribute?**  
A: Yes! See [Contributing Guide](../CONTRIBUTING.md)

**Q: How do I report bugs?**  
A: Open an issue on GitHub following the [bug report template](CONTRIBUTING.md#bug-reports)

---

## 📞 Getting Help

- **Documentation:** You're here! 📖
- **GitHub Issues:** [Report bugs](https://github.com/yourusername/plugrag/issues)
- **GitHub Discussions:** [Ask questions](https://github.com/yourusername/plugrag/discussions)
- **Email:** support@plugrag.com (if available)

---

## 🔄 Documentation Updates

This documentation is updated regularly. Last updated: January 10, 2026

**Recent changes:**
- Complete documentation restructure
- New Getting Started guide
- Comprehensive API reference
- Deployment guides for multiple platforms
- Docker deployment documentation

**Contributing to docs:**
- See [Contributing Guide](../CONTRIBUTING.md#documentation)
- Submit PRs for improvements
- Report documentation issues

---

## 📄 License

All documentation is licensed under MIT License.

---

<div align="center">
  
**Need help? Have questions?**

[Open an Issue](https://github.com/yourusername/plugrag/issues) • [Start a Discussion](https://github.com/yourusername/plugrag/discussions)

</div>
