# 🚀 PlugRAG Deployment Guide

Complete guide for deploying PlugRAG to production environments.

## 📖 Table of Contents

- [Deployment Options](#deployment-options)
- [Prerequisites](#prerequisites)
- [Vercel Deployment](#vercel-deployment)
- [Docker Deployment](#docker-deployment)
- [AWS Deployment](#aws-deployment)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Security Checklist](#security-checklist)
- [Monitoring & Maintenance](#monitoring--maintenance)

---

## 🎯 Deployment Options

### Recommended Platforms

| Platform | Best For | Difficulty | Cost |
|----------|----------|------------|------|
| **Vercel** | Quick deployment, serverless | Easy | Free tier available |
| **Docker** | Full control, self-hosted | Medium | Infrastructure cost |
| **AWS** | Enterprise, high scale | Advanced | Pay-as-you-go |
| **DigitalOcean** | Simple VPS hosting | Medium | $12+/month |

---

## 📋 Prerequisites

### Required Services

1. **MongoDB Atlas** (Database)
   - Free tier: M0 (512 MB storage)
   - Recommended: M10+ for production
   - [Sign up](https://www.mongodb.com/cloud/atlas)

2. **Clerk** (Authentication)
   - Free tier: 10,000 MAUs
   - [Sign up](https://clerk.com/)

3. **OpenAI** (AI/ML)
   - Pay-per-use pricing
   - [Get API key](https://platform.openai.com/api-keys)

4. **AWS S3** (File Storage)
   - Free tier: 5 GB storage
   - [Create bucket](https://aws.amazon.com/s3/)

5. **Redis** (Job Queue)
   - Upstash: Free tier available
   - Self-hosted: Docker or VPS

6. **Qdrant** (Vector Database)
   - Qdrant Cloud: Free tier
   - Self-hosted: Docker

### System Requirements

- **Node.js:** 20.11 or higher
- **Memory:** 2GB minimum, 4GB recommended
- **Storage:** 10GB minimum
- **Network:** HTTPS with valid SSL certificate

---

## 🎨 Vercel Deployment

### Step 1: Prepare Your Repository

```bash
# Ensure package.json is configured
npm install

# Test build locally
npm run build
```

### Step 2: Deploy to Vercel

#### Option A: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel
```

#### Option B: GitHub Integration

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your repository
5. Vercel auto-detects Next.js configuration

### Step 3: Configure Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

```env
MONGODB_URI=mongodb+srv://...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_WEBHOOK_SECRET=whsec_...
ENCRYPTION_SECRET_KEY=your-32-char-key-here!!!!!!!!
OPENAI_API_KEY=sk-...
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
REDIS_HOST=your-redis-host
REDIS_PORT=6379
QDRANT_URL=https://your-qdrant-instance
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

### Step 4: Deploy Worker Separately

Vercel doesn't support long-running processes. Options:

#### Option A: Render.com Worker

1. Create new Web Service on Render
2. Connect your repository
3. Set build command: `npm install`
4. Set start command: `npm run worker`
5. Add same environment variables

#### Option B: Railway.app Worker

1. Create new project
2. Deploy from GitHub
3. Override start command: `npm run worker`
4. Add environment variables

### Step 5: Configure Webhooks

1. In Clerk Dashboard:
   - Go to Webhooks
   - Add endpoint: `https://your-domain.vercel.app/api/webhooks/clerk`
   - Select events: user.created, user.updated, user.deleted
   - Copy webhook secret to `CLERK_WEBHOOK_SECRET`

### Vercel Configuration

Create `vercel.json`:

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "NODE_ENV": "production"
  }
}
```

---

## 🐳 Docker Deployment

### Full Docker Setup

See [DOCKER.md](../DOCKER.md) for comprehensive Docker documentation.

### Quick Start

```bash
# Create .env.local with your credentials
cp .env.example .env.local

# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f
```

### Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
      # Add all environment variables from .env.local
    ports:
      - "3000:3000"
    depends_on:
      - redis
      - qdrant
    restart: always

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    environment:
      - NODE_ENV=production
      # Add all environment variables
    depends_on:
      - redis
      - qdrant
    restart: always
    deploy:
      replicas: 2  # Scale workers

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: always

  qdrant:
    image: qdrant/qdrant:latest
    volumes:
      - qdrant_storage:/qdrant/storage
    restart: always

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: always

volumes:
  redis_data:
  qdrant_storage:
```

### Deploy

```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## ☁️ AWS Deployment

### Architecture

```
┌─────────────────────────────────────────┐
│              CloudFront (CDN)           │
└─────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────┐
│        ALB (Application Load Balancer)  │
└─────────────────────────────────────────┘
                    ▼
┌──────────────┐        ┌──────────────┐
│  ECS Fargate │        │  ECS Fargate │
│   (App)      │        │   (Worker)   │
└──────────────┘        └──────────────┘
        ▼                       ▼
┌──────────────┐        ┌──────────────┐
│ ElastiCache  │        │ DocumentDB   │
│   (Redis)    │        │  (MongoDB)   │
└──────────────┘        └──────────────┘
```

### Step 1: Prepare Docker Images

```bash
# Build images
docker build -t plugrag-app:latest .
docker build -t plugrag-worker:latest -f Dockerfile.worker .

# Tag for ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com

docker tag plugrag-app:latest <account>.dkr.ecr.us-east-1.amazonaws.com/plugrag-app:latest
docker tag plugrag-worker:latest <account>.dkr.ecr.us-east-1.amazonaws.com/plugrag-worker:latest

# Push to ECR
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/plugrag-app:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/plugrag-worker:latest
```

### Step 2: Create ECS Task Definitions

**App Task Definition:**

```json
{
  "family": "plugrag-app",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "app",
      "image": "<account>.dkr.ecr.us-east-1.amazonaws.com/plugrag-app:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        // Add environment variables
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/plugrag-app",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### Step 3: Create ECS Service

```bash
aws ecs create-service \
  --cluster plugrag-cluster \
  --service-name plugrag-app \
  --task-definition plugrag-app \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=app,containerPort=3000"
```

### Step 4: Configure Auto Scaling

```bash
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/plugrag-cluster/plugrag-app \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10
```

### Infrastructure as Code

Use Terraform or CloudFormation for reproducible deployments.

**Terraform Example:**

```hcl
resource "aws_ecs_cluster" "plugrag" {
  name = "plugrag-cluster"
}

resource "aws_ecs_service" "app" {
  name            = "plugrag-app"
  cluster         = aws_ecs_cluster.plugrag.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 2
  launch_type     = "FARGATE"
  
  # ... network configuration
}
```

---

## ⚙️ Environment Configuration

### Production Environment Variables

```env
# Database
MONGODB_URI=mongodb+srv://prod-cluster.mongodb.net/plugrag?retryWrites=true&w=majority

# Authentication
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_WEBHOOK_SECRET=whsec_...

# Encryption (CRITICAL: Use strong 32-char key)
ENCRYPTION_SECRET_KEY=USE-STRONG-32-CHARACTER-KEY!!

# OpenAI
OPENAI_API_KEY=sk-...

# AWS S3
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=plugrag-production-files

# Redis
REDIS_HOST=prod-redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=...  # If using password auth

# Qdrant
QDRANT_URL=https://prod-qdrant.example.com:6333
QDRANT_API_KEY=...  # If using API key

# Application
NEXT_PUBLIC_APP_URL=https://plugrag.com
NODE_ENV=production
```

### Secrets Management

#### Option A: AWS Secrets Manager

```bash
# Store secret
aws secretsmanager create-secret \
  --name plugrag/production/mongodb \
  --secret-string "mongodb+srv://..."

# Retrieve in application
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
```

#### Option B: Vercel Environment Variables

Encrypted and injected at build/runtime.

#### Option C: Docker Secrets

```yaml
secrets:
  mongodb_uri:
    external: true

services:
  app:
    secrets:
      - mongodb_uri
```

---

## 🗄️ Database Setup

### MongoDB Atlas Production Setup

1. **Create Production Cluster**
   - Tier: M10+ (dedicated cluster)
   - Region: Choose closest to your users
   - Enable backups

2. **Configure Network Access**
   ```
   Add IP: 0.0.0.0/0 (for Vercel/Serverless)
   Or specific IPs for VPS/Docker
   ```

3. **Create Database User**
   ```
   Username: plugrag-prod
   Password: <strong-password>
   Role: readWrite on plugrag database
   ```

4. **Get Connection String**
   ```
   mongodb+srv://plugrag-prod:<password>@cluster.mongodb.net/plugrag?retryWrites=true&w=majority
   ```

### Qdrant Production Setup

#### Option A: Qdrant Cloud

1. Create cluster at [cloud.qdrant.io](https://cloud.qdrant.io)
2. Note cluster URL and API key
3. Add to environment variables

#### Option B: Self-Hosted

```yaml
# docker-compose.yml
services:
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage
    environment:
      - QDRANT__SERVICE__API_KEY=your-api-key
```

### Redis Production Setup

#### Option A: Upstash (Serverless Redis)

1. Create database at [upstash.com](https://upstash.com)
2. Copy connection details
3. Works perfectly with Vercel

#### Option B: Redis Cloud

1. Create database at [redis.com](https://redis.com)
2. Note connection string
3. Enable persistence

#### Option C: Self-Hosted

```yaml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass yourpassword
    volumes:
      - redis_data:/data
```

---

## 🔒 Security Checklist

### Pre-Deployment

- [ ] All secrets in environment variables (not committed to git)
- [ ] Strong `ENCRYPTION_SECRET_KEY` (32 characters)
- [ ] HTTPS enabled with valid SSL certificate
- [ ] Database connections use TLS/SSL
- [ ] Clerk webhook secret configured
- [ ] S3 bucket policies restrict access
- [ ] MongoDB IP whitelist configured
- [ ] Rate limiting enabled
- [ ] Input sanitization active
- [ ] Error messages don't expose sensitive info

### Post-Deployment

- [ ] Test authentication flow
- [ ] Verify file upload works
- [ ] Check Clerk webhooks receiving events
- [ ] Monitor error logs
- [ ] Test chat widget on multiple domains
- [ ] Verify domain whitelist enforcement
- [ ] Check rate limits working
- [ ] Test API endpoints
- [ ] Backup strategy in place
- [ ] Monitoring/alerting configured

---

## 📊 Monitoring & Maintenance

### Application Monitoring

#### Vercel Analytics
- Automatically enabled
- View in Vercel Dashboard

#### Custom Logging

```javascript
// src/lib/utils/logger.js
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
});
```

### Database Monitoring

#### MongoDB Atlas
- Enable Performance Advisor
- Set up alerts for CPU/memory
- Monitor slow queries

#### Qdrant
- Check collection sizes
- Monitor query performance
- Track memory usage

### Error Tracking

#### Sentry Integration

```bash
npm install @sentry/nextjs
```

```javascript
// sentry.config.js
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

### Health Checks

Set up monitoring for `/api/health`:

```bash
# UptimeRobot, Pingdom, or custom
curl https://your-domain.com/api/health
```

### Backup Strategy

1. **MongoDB:**
   - Atlas: Continuous Cloud Backup
   - Export: `mongodump` weekly

2. **Qdrant:**
   - Snapshot collections regularly
   - Volume backups for Docker

3. **S3:**
   - Enable versioning
   - Lifecycle policies for old files

4. **Redis:**
   - AOF persistence enabled
   - Snapshot backups

### Log Aggregation

- CloudWatch (AWS)
- Papertrail
- Datadog
- LogDNA

---

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

---

## 🚨 Troubleshooting

### Common Issues

#### Build Failures

```bash
# Clear cache
npm cache clean --force
rm -rf .next node_modules
npm install
npm run build
```

#### Database Connection Errors

- Check IP whitelist
- Verify connection string
- Test with MongoDB Compass

#### File Upload Failures

- Check S3 credentials
- Verify bucket permissions
- Test presigned URL generation

#### Worker Not Processing

- Check Redis connection
- Verify worker is running
- Check environment variables

---

## 📚 Additional Resources

- [Docker Deployment Guide](../DOCKER.md)
- [Architecture Documentation](ARCHITECTURE.md)
- [API Reference](API-REFERENCE.md)
- [Getting Started](GETTING-STARTED.md)

---

## 🆘 Support

For deployment support:
- Documentation: This guide
- Issues: GitHub Issues
- Community: Discussions
