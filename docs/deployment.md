# 🚀 PlugRAG Deployment Guide

> **Complete guide for deploying PlugRAG to production environments**

## 📋 **Table of Contents**
- [Deployment Overview](#deployment-overview)
- [Environment Setup](#environment-setup)
- [Serverless Deployment (Vercel)](#serverless-deployment-vercel)
- [Container Deployment](#container-deployment)
- [Database Setup](#database-setup)
- [Vector Database Setup](#vector-database-setup)
- [Environment Variables](#environment-variables)
- [Production Checklist](#production-checklist)
- [Monitoring & Logging](#monitoring--logging)
- [Scaling & Performance](#scaling--performance)

---

## 🎯 **Deployment Overview**

PlugRAG supports multiple deployment strategies to fit different infrastructure requirements:

### **Deployment Options**
- **🚀 Serverless (Recommended)**: Vercel, AWS Lambda, Azure Functions
- **🐳 Containerized**: Docker, Kubernetes, AWS ECS, Google Cloud Run  
- **☁️ Traditional VPS**: DigitalOcean, Linode, AWS EC2
- **🏢 On-Premise**: Private cloud, datacenter deployment

### **Production Architecture**

```mermaid
graph TB
    subgraph "CDN & Load Balancer"
        A[Cloudflare/AWS CloudFront] --> B[Load Balancer]
    end
    
    subgraph "Application Tier"
        B --> C[Next.js App 1]
        B --> D[Next.js App 2]
        B --> E[Next.js App N]
    end
    
    subgraph "Data Tier"
        F[(MongoDB Atlas)] --> G[Primary Replica]
        F --> H[Secondary Replica 1]
        F --> I[Secondary Replica N]
        
        J[(Qdrant Cloud)] --> K[Vector Storage]
        J --> L[Backup Instance]
    end
    
    subgraph "Caching Layer"
        M[Redis Cluster] --> N[Cache Node 1]
        M --> O[Cache Node 2]
    end
    
    subgraph "External Services"
        P[Clerk Auth]
        Q[OpenAI API]
        R[Stripe Payments]
        S[SendGrid Email]
    end
    
    C --> F
    C --> J
    C --> M
    C --> P
    C --> Q
    
    classDef cdn fill:#3B82F6,stroke:#1E40AF,color:#FFFFFF
    classDef app fill:#EF4444,stroke:#DC2626,color:#FFFFFF  
    classDef data fill:#10B981,stroke:#059669,color:#FFFFFF
    classDef cache fill:#F59E0B,stroke:#D97706,color:#FFFFFF
    classDef external fill:#8B5CF6,stroke:#7C3AED,color:#FFFFFF
    
    class A,B cdn
    class C,D,E app
    class F,G,H,I,J,K,L data
    class M,N,O cache
    class P,Q,R,S external
```

---

## 🛠️ **Environment Setup**

### **Prerequisites**

```bash
# Required software versions
Node.js: >= 20.0.0
npm: >= 10.0.0
Docker: >= 24.0.0 (for containerized deployment)
MongoDB: >= 7.0
Redis: >= 7.0 (optional, for caching)
```

### **Local Development Setup**

```bash
# 1. Clone the repository
git clone https://github.com/your-username/plugrag.git
cd plugrag

# 2. Install dependencies
npm install

# 3. Copy environment variables
cp .env.example .env.local

# 4. Configure environment variables (see Environment Variables section)
nano .env.local

# 5. Set up local databases (optional)
docker-compose up -d mongodb qdrant redis

# 6. Run database migrations
npm run db:migrate

# 7. Start development server
npm run dev

# 8. Verify installation
curl http://localhost:3000/api/health
```

---

## 🚀 **Serverless Deployment (Vercel)**

### **Vercel Setup** ⭐ *Recommended for quick deployment*

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login to Vercel
vercel login

# 3. Deploy to Vercel
vercel --prod

# 4. Configure environment variables in Vercel dashboard
# Go to: Project Settings → Environment Variables
```

### **Vercel Configuration**

Create `vercel.json`:
```json
{
  "version": 2,
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "functions": {
    "src/app/api/files/route.js": {
      "maxDuration": 300
    },
    "src/app/api/vectors/process/[fileId]/route.js": {
      "maxDuration": 300
    },
    "src/app/api/chat/[botId]/route.js": {
      "maxDuration": 60
    }
  },
  "env": {
    "NODE_ENV": "production",
    "NEXT_TELEMETRY_DISABLED": "1"
  },
  "regions": ["iad1", "sfo1"],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "https://your-domain.com"
        },
        {
          "key": "Access-Control-Allow-Methods", 
          "value": "GET, POST, PUT, DELETE, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "Content-Type, Authorization"
        }
      ]
    }
  ],
  "redirects": [
    {
      "source": "/dashboard",
      "has": [
        {
          "type": "cookie",
          "key": "__session"
        }
      ],
      "permanent": false,
      "destination": "/dashboard/bots"
    }
  ]
}
```

### **AWS Lambda Deployment**

```bash
# Using Serverless Framework
npm install -g serverless
npm install serverless-nextjs-plugin

# Create serverless.yml
cat > serverless.yml << EOF
service: plugrag-app

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1
  memorySize: 1024
  timeout: 30
  environment:
    NODE_ENV: production

plugins:
  - serverless-nextjs-plugin

custom:
  serverless-nextjs:
    nextConfigDir: ./
    compatibilityMode: v3

functions:
  app:
    handler: index.handler
    events:
      - http:
          path: /{any+}
          method: any
      - http:
          path: /
          method: any
EOF

# Deploy
serverless deploy --stage production
```

---

## 🐳 **Container Deployment**

### **Docker Setup**

Create `Dockerfile`:
```dockerfile
# Multi-stage build for optimized production image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN \
  if [ -f package-lock.json ]; then npm ci --only=production --silent; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment for build
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Build application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Create nextjs user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
```

### **Docker Compose Setup**

Create `docker-compose.prod.yml`:
```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=${MONGODB_URI}
      - QDRANT_URL=${QDRANT_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    restart: unless-stopped
    depends_on:
      - mongodb
      - qdrant
      - redis
    networks:
      - plugrag-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.plugrag.rule=Host(`your-domain.com`)"
      - "traefik.http.routers.plugrag.tls.certresolver=le"

  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=${MONGO_USERNAME}
      - MONGO_INITDB_ROOT_PASSWORD=${MONGO_PASSWORD}
      - MONGO_INITDB_DATABASE=plugrag
    volumes:
      - mongodb_data:/data/db
      - ./mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    restart: unless-stopped
    networks:
      - plugrag-network

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage
    environment:
      - QDRANT__SERVICE__HTTP_PORT=6333
      - QDRANT__SERVICE__GRPC_PORT=6334
    restart: unless-stopped
    networks:
      - plugrag-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    restart: unless-stopped
    networks:
      - plugrag-network

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
    restart: unless-stopped
    networks:
      - plugrag-network

volumes:
  mongodb_data:
  qdrant_data:
  redis_data:

networks:
  plugrag-network:
    driver: bridge
```

### **Kubernetes Deployment**

Create `k8s/deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: plugrag-app
  labels:
    app: plugrag
spec:
  replicas: 3
  selector:
    matchLabels:
      app: plugrag
  template:
    metadata:
      labels:
        app: plugrag
    spec:
      containers:
      - name: plugrag
        image: your-registry/plugrag:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: plugrag-secrets
              key: mongodb-uri
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: plugrag-secrets
              key: openai-api-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: plugrag-service
spec:
  selector:
    app: plugrag
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: plugrag-ingress
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - your-domain.com
    secretName: plugrag-tls
  rules:
  - host: your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: plugrag-service
            port:
              number: 80
```

---

## 🗄️ **Database Setup**

### **MongoDB Atlas (Recommended)**

```bash
# 1. Create MongoDB Atlas account at https://cloud.mongodb.com
# 2. Create a new cluster
# 3. Configure network access (whitelist your app's IP)
# 4. Create database user
# 5. Get connection string

# Example connection string format:
MONGODB_URI="mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority"
```

### **Self-Hosted MongoDB**

```bash
# Install MongoDB on Ubuntu/Debian
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Create application database
mongosh --eval "
use plugrag;
db.createUser({
  user: 'plugrag_user',
  pwd: 'secure_password_here',
  roles: [
    { role: 'readWrite', db: 'plugrag' }
  ]
});
"
```

### **Database Configuration**

Create `mongo-init.js` for Docker setup:
```javascript
// Initialize database with required indexes
db = db.getSiblingDB('plugrag');

// Create application user
db.createUser({
  user: 'plugrag_user',
  pwd: 'secure_password',
  roles: [
    { role: 'readWrite', db: 'plugrag' }
  ]
});

// Create performance indexes
db.users.createIndex({ "clerkId": 1 }, { unique: true });
db.bots.createIndex({ "ownerId": 1, "status": 1 });
db.bots.createIndex({ "botKey": 1 }, { unique: true });
db.files.createIndex({ "botId": 1, "status": 1 });
db.conversations.createIndex({ "botId": 1, "sessionId": 1 });
db.conversations.createIndex({ "botId": 1, "createdAt": -1 });

print("Database initialization completed");
```

---

## 🔍 **Vector Database Setup**

### **Qdrant Cloud (Recommended)**

```bash
# 1. Sign up at https://cloud.qdrant.io
# 2. Create a new cluster
# 3. Get API URL and key
# 4. Configure environment variables

QDRANT_URL="https://your-cluster.qdrant.io"
QDRANT_API_KEY="your-api-key"
```

### **Self-Hosted Qdrant**

```bash
# Using Docker
docker run -p 6333:6333 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant:latest

# Using Docker Compose (see docker-compose.prod.yml above)

# Or install directly on Ubuntu/Debian
curl -L https://github.com/qdrant/qdrant/releases/latest/download/qdrant-x86_64-unknown-linux-gnu.tar.gz | tar xz
sudo mv qdrant /usr/local/bin/
sudo chmod +x /usr/local/bin/qdrant

# Create systemd service
sudo tee /etc/systemd/system/qdrant.service << EOF
[Unit]
Description=Qdrant Vector Database
After=network.target

[Service]
Type=simple
User=qdrant
WorkingDirectory=/opt/qdrant
ExecStart=/usr/local/bin/qdrant --config-path /opt/qdrant/config.yaml
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable qdrant
sudo systemctl start qdrant
```

### **Qdrant Configuration**

Create `/opt/qdrant/config.yaml`:
```yaml
service:
  host: 0.0.0.0
  http_port: 6333
  grpc_port: 6334

storage:
  # Path to the storage directory
  storage_path: ./storage
  
  # Configure Write-Ahead Log
  wal:
    wal_capacity_mb: 32
    wal_segments_ahead: 0

# Performance optimization
cluster:
  enabled: false
  
hnsw_index:
  m: 16
  ef_construct: 100
  full_scan_threshold: 10000

optimizers:
  default_segment_number: 2
  max_segment_size: 20000
  memmap_threshold: 50000
  indexing_threshold: 20000
  flush_interval_sec: 5
```

---

## 🔑 **Environment Variables**

### **Required Environment Variables**

```bash
# Application
NODE_ENV=production
PORT=3000
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-nextauth-secret-here

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/plugrag

# Vector Database
QDRANT_URL=https://your-qdrant-cluster.com
QDRANT_API_KEY=your-qdrant-api-key

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# AI Services
OPENAI_API_KEY=sk-...
OPENAI_ORG_ID=org-...

# Encryption
ENCRYPTION_KEY=your-32-char-encryption-key-here
ENCRYPTION_SALT=your-random-salt

# File Upload
UPLOAD_MAX_SIZE=52428800  # 50MB
ALLOWED_FILE_TYPES=pdf,docx,txt,csv,html

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=900  # 15 minutes

# Caching (optional)
REDIS_URL=redis://localhost:6379
CACHE_TTL=300  # 5 minutes

# Monitoring (optional)
SENTRY_DSN=https://your-sentry-dsn
LOGTAIL_SOURCE_TOKEN=your-logtail-token

# Analytics (optional)
GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
MIXPANEL_TOKEN=your-mixpanel-token
```

### **Environment Variable Validation**

Create `.env.example`:
```bash
# Copy this file to .env.local and fill in your values

# Required - Application will not start without these
NODE_ENV=production
NEXTAUTH_URL=
NEXTAUTH_SECRET=
MONGODB_URI=
QDRANT_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
OPENAI_API_KEY=

# Optional - Features will be disabled without these
QDRANT_API_KEY=
REDIS_URL=
SENTRY_DSN=
```

### **Environment Variable Security**

```bash
# Generate secure random values
openssl rand -hex 32  # For NEXTAUTH_SECRET
openssl rand -hex 32  # For ENCRYPTION_KEY
openssl rand -base64 32  # For ENCRYPTION_SALT

# Validate environment variables script
cat > scripts/validate-env.js << 'EOF'
const required = [
  'NODE_ENV',
  'NEXTAUTH_URL', 
  'NEXTAUTH_SECRET',
  'MONGODB_URI',
  'QDRANT_URL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'OPENAI_API_KEY'
];

const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(key => console.error(`  - ${key}`));
  process.exit(1);
}

console.log('✅ All required environment variables are set');
EOF

node scripts/validate-env.js
```

---

## ✅ **Production Checklist**

### **Security Checklist**
- [ ] All environment variables are properly set
- [ ] Database has authentication enabled
- [ ] API keys are properly encrypted
- [ ] HTTPS is enabled and enforced
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled
- [ ] Input validation is implemented
- [ ] File upload limits are enforced
- [ ] Error messages don't leak sensitive info

### **Performance Checklist**  
- [ ] Database indexes are created
- [ ] Vector database is optimized
- [ ] Caching is enabled (Redis)
- [ ] CDN is configured for static assets
- [ ] Gzip compression is enabled
- [ ] Bundle size is optimized
- [ ] Images are optimized
- [ ] Database connection pooling is configured

### **Reliability Checklist**
- [ ] Health checks are implemented
- [ ] Error monitoring is set up (Sentry)
- [ ] Logging is configured
- [ ] Backup strategy is implemented
- [ ] Graceful shutdown is implemented
- [ ] Auto-scaling is configured
- [ ] Load balancing is set up
- [ ] Failover procedures are documented

### **Monitoring Checklist**
- [ ] Application metrics are tracked
- [ ] Database performance is monitored
- [ ] API response times are tracked
- [ ] Error rates are monitored
- [ ] User analytics are implemented
- [ ] Alerts are configured
- [ ] Uptime monitoring is set up

---

## 📊 **Monitoring & Logging**

### **Application Monitoring**

```javascript
// lib/monitoring.js
import { init } from '@sentry/nextjs';

// Initialize Sentry for error tracking
init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Filter out sensitive information
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  }
});

// Custom performance monitoring
export class PerformanceMonitor {
  static startTimer(operation) {
    return {
      operation,
      start: Date.now()
    };
  }
  
  static endTimer(timer) {
    const duration = Date.now() - timer.start;
    
    // Log performance metrics
    console.log(`[PERF] ${timer.operation}: ${duration}ms`);
    
    // Send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Send to your monitoring service
    }
    
    return duration;
  }
  
  static trackAPICall(endpoint, method, statusCode, responseTime) {
    const metrics = {
      endpoint,
      method,
      statusCode,
      responseTime,
      timestamp: new Date().toISOString()
    };
    
    // Log API metrics
    console.log('[API]', JSON.stringify(metrics));
  }
}
```

### **Health Check Endpoint**

```javascript
// app/api/health/route.js
import { connectToMongoDB } from '@/lib/mongo';
import { qdrantClient } from '@/lib/vectorStore';

export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || 'unknown',
    environment: process.env.NODE_ENV,
    checks: {}
  };

  try {
    // Check MongoDB connection
    const mongoTimer = Date.now();
    await connectToMongoDB();
    health.checks.mongodb = {
      status: 'healthy',
      responseTime: Date.now() - mongoTimer
    };
  } catch (error) {
    health.checks.mongodb = {
      status: 'unhealthy',
      error: error.message
    };
    health.status = 'unhealthy';
  }

  try {
    // Check Qdrant connection
    const qdrantTimer = Date.now();
    await qdrantClient.getCollections();
    health.checks.qdrant = {
      status: 'healthy',
      responseTime: Date.now() - qdrantTimer
    };
  } catch (error) {
    health.checks.qdrant = {
      status: 'unhealthy', 
      error: error.message
    };
    health.status = 'unhealthy';
  }

  // Check OpenAI API (optional)
  if (process.env.OPENAI_API_KEY) {
    try {
      const openaiTimer = Date.now();
      // Simple API test
      health.checks.openai = {
        status: 'healthy',
        responseTime: Date.now() - openaiTimer
      };
    } catch (error) {
      health.checks.openai = {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  
  return new Response(JSON.stringify(health), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
}
```

---

## 📈 **Scaling & Performance**

### **Auto-scaling Configuration**

```yaml
# k8s/hpa.yaml - Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: plugrag-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: plugrag-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
```

### **Load Balancer Configuration**

```nginx
# nginx.conf
upstream plugrag_backend {
    least_conn;
    server app1:3000 max_fails=3 fail_timeout=30s;
    server app2:3000 max_fails=3 fail_timeout=30s;
    server app3:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL configuration
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain application/json application/javascript text/css;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=chat:10m rate=5r/s;
    
    # API routes
    location /api/chat {
        limit_req zone=chat burst=10 nodelay;
        proxy_pass http://plugrag_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Websocket support (if needed)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location /api {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://plugrag_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static files
    location /_next/static {
        proxy_pass http://plugrag_backend;
        proxy_cache_valid 200 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Everything else
    location / {
        proxy_pass http://plugrag_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Health check
    location /health {
        access_log off;
        proxy_pass http://plugrag_backend/api/health;
    }
}
```

### **Database Scaling**

```javascript
// MongoDB connection with replica set
const mongoOptions = {
  // Connection pooling
  maxPoolSize: 50,
  minPoolSize: 5,
  maxIdleTimeMS: 30000,
  
  // Replica set configuration
  readPreference: 'secondaryPreferred',
  readConcern: { level: 'majority' },
  writeConcern: { w: 'majority', j: true },
  
  // Connection timeouts
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  
  // Retry configuration
  retryWrites: true,
  retryReads: true
};

// Qdrant cluster configuration
const qdrantCluster = {
  nodes: [
    'https://node1.qdrant.cluster.com',
    'https://node2.qdrant.cluster.com', 
    'https://node3.qdrant.cluster.com'
  ],
  loadBalancing: 'round_robin',
  healthCheck: {
    interval: 30000,
    timeout: 5000
  }
};
```

---

<div align="center">

**🚀 Your PlugRAG application is now ready for production!**  
[Security Guide](./security.md) • [Performance Optimization](./performance.md) • [Troubleshooting](./troubleshooting.md)

</div>