# Development Guide - PlugRAG Platform

This guide covers setup, development workflow, testing, and contribution guidelines for the PlugRAG platform.

## 🛠️ Development Setup

### Prerequisites

- **Node.js** 20.11+ (LTS recommended)
- **Docker** and Docker Compose
- **Git** for version control
- **VS Code** (recommended) with extensions:
  - ES6+ snippets
  - Prettier
  - ESLint
  - Tailwind CSS IntelliSense

### Environment Configuration

Create `.env.local` in the project root:

```bash
# Authentication (Get from Clerk Dashboard)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Database (MongoDB Atlas)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/

# Vector Database (Local Qdrant)
QDRANT_URL=http://localhost:6333

# AI Services (OpenAI)
OPENAI_API_KEY=sk-proj-...
```

### Installation

```bash
# Clone the repository
git clone https://github.com/Kanishk2004/chat-bot.git
cd chat-bot

# Install dependencies
npm install

# Start Qdrant vector database
docker-compose up -d

# Start development server
npm run dev
```

### Verification

```bash
# Test vector integration
node test/simple-vector-test.js

# Check API health
curl http://localhost:3000/api/vectors/health
```

## 🏗️ Project Structure

```
chat-bot/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── files/         # File processing endpoints
│   │   │   ├── vectors/       # Vector storage endpoints
│   │   │   └── webhooks/      # Clerk webhooks
│   │   ├── dashboard/         # Dashboard pages
│   │   └── globals.css        # Global styles
│   ├── components/            # React components
│   ├── lib/                   # Utilities and services
│   │   ├── extractors/        # Text extraction services
│   │   ├── embeddings.js      # OpenAI embeddings
│   │   ├── qdrant.js          # Qdrant vector database
│   │   ├── vectorStorage.js   # Combined vector service
│   │   ├── mongo.js           # MongoDB connection
│   │   ├── performance.js     # Performance monitoring
│   │   └── user.js            # User management
│   └── models/                # MongoDB schemas
├── docs/                      # Documentation
├── test/                      # Test files
├── docker-compose.yaml        # Qdrant container
└── package.json              # Dependencies
```

## 🔧 Development Workflow

### 1. Code Style and Linting

The project uses ESLint for code quality:

```bash
# Run linting
npm run lint

# Auto-fix issues
npm run lint -- --fix
```

**Code Style Guidelines:**
- Use ES6+ features and async/await
- Prefer functional components with hooks
- Use meaningful variable and function names
- Add JSDoc comments for functions
- Keep functions small and focused

### 2. Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: add your feature description"

# Push and create PR
git push origin feature/your-feature-name
```

**Commit Message Format:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions or updates
- `chore:` Build process or auxiliary tool changes

### 3. API Development

When adding new API endpoints:

1. **Create the route file** in appropriate directory
2. **Add authentication** using Clerk
3. **Validate input** and handle errors
4. **Add to API documentation**
5. **Write tests**

Example API endpoint structure:

```javascript
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import connectMongo from '@/lib/mongo';

export async function POST(request) {
  try {
    // Authentication
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate input
    const body = await request.json();
    if (!body.requiredField) {
      return NextResponse.json(
        { success: false, error: 'Required field missing' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectMongo();

    // Business logic here
    
    // Return success response
    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## 🧪 Testing

### Unit Tests

Run individual component tests:

```bash
# Test vector integration
node test/simple-vector-test.js

# Test specific functionality
node test/vector-integration.test.js
```

### Integration Tests

Test complete workflows:

```bash
# Start services
docker-compose up -d
npm run dev

# Test file upload and processing
curl -X POST http://localhost:3000/api/files \
  -F "file=@test-document.pdf" \
  -F "botId=test-bot-id" \
  -F "options={\"generateEmbeddings\":true}"

# Test vector search
curl -X POST http://localhost:3000/api/vectors/search \
  -H "Content-Type: application/json" \
  -d '{"botId":"test-bot-id","query":"test query"}'
```

### Writing Tests

Create test files in the `test/` directory:

```javascript
import { testFunction } from '../src/lib/myModule.js';

async function testMyFeature() {
  console.log('Testing my feature...');
  
  try {
    const result = await testFunction('test input');
    
    if (result.success) {
      console.log('✅ Test passed');
    } else {
      console.log('❌ Test failed:', result.error);
    }
  } catch (error) {
    console.log('❌ Test error:', error.message);
  }
}

testMyFeature();
```

## 🐛 Debugging

### Common Issues

**1. Environment Variables Not Loading**
```bash
# Check if .env.local exists and has correct format
cat .env.local

# For tests, use dotenv
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
```

**2. Qdrant Connection Failed**
```bash
# Check if container is running
docker ps

# Check container logs
docker logs chat-bot-qdrant-1

# Restart container
docker-compose restart
```

**3. MongoDB Connection Issues**
```bash
# Test connection string
node -e "
import mongoose from 'mongoose';
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('❌ MongoDB error:', err.message));
"
```

**4. OpenAI API Errors**
```bash
# Test API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Debug Tools

**Enable Debug Mode:**
```javascript
// In development, set DEBUG environment variable
process.env.DEBUG = 'true';

// Add debug logging
if (process.env.DEBUG) {
  console.log('Debug info:', debugData);
}
```

**Performance Monitoring:**
```javascript
import { PerformanceMonitor } from '@/lib/performance';

PerformanceMonitor.startTimer('operation-name');
// ... your code
PerformanceMonitor.endTimer('operation-name');
```

## 🚀 Deployment

### Environment Setup

**Production Environment Variables:**
```bash
# Use production URLs and keys
QDRANT_URL=https://your-qdrant-instance.com
MONGODB_URI=mongodb+srv://prod-user:password@prod-cluster.mongodb.net/
OPENAI_API_KEY=sk-proj-production-key
```

### Vercel Deployment

1. **Push to GitHub**
2. **Connect to Vercel**
3. **Set environment variables**
4. **Deploy**

```bash
# Optional: Test build locally
npm run build
npm run start
```

### Docker Deployment

```dockerfile
# Dockerfile (example)
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

## 📋 Contribution Guidelines

### Before Contributing

1. **Check existing issues** or create a new one
2. **Discuss major changes** in issues first
3. **Follow coding standards** and conventions
4. **Write tests** for new features
5. **Update documentation** as needed

### Pull Request Process

1. **Fork the repository**
2. **Create feature branch**
3. **Make changes with tests**
4. **Update documentation**
5. **Submit pull request**

**PR Checklist:**
- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No merge conflicts
- [ ] Clear commit messages

### Code Review

All PRs require review and must:
- Pass all tests
- Have appropriate documentation
- Follow security best practices
- Be backwards compatible (when possible)

## 🎯 Performance Guidelines

### Best Practices

**1. File Processing:**
- Use streaming for large files
- Implement progress tracking
- Add timeout handling
- Cache processed results

**2. Vector Operations:**
- Batch embedding generation
- Use appropriate chunk sizes
- Implement retry logic
- Monitor token usage

**3. Database Operations:**
- Use connection pooling
- Add proper indexes
- Implement pagination
- Use projection to limit fields

**4. API Design:**
- Add rate limiting
- Implement caching
- Use compression
- Add request validation

### Monitoring

```javascript
// Performance monitoring
import { PerformanceMonitor } from '@/lib/performance';

const timer = PerformanceMonitor.startTimer('file-processing');
// ... processing logic
PerformanceMonitor.endTimer(timer);

// Resource monitoring
const stats = await PerformanceMonitor.getStats();
console.log('Memory usage:', stats.memory);
console.log('Processing times:', stats.timers);
```

## 🛡️ Security Guidelines

### API Security

- Always validate input
- Use authentication on all endpoints
- Implement rate limiting
- Sanitize file uploads
- Add CORS protection

### Data Security

- Encrypt sensitive data
- Use environment variables for secrets
- Implement proper access controls
- Regular security audits
- Keep dependencies updated

This development guide provides the foundation for contributing to and maintaining the PlugRAG platform. Happy coding! 🚀