# Load Capacity & Hosting Guide

This document provides an analysis of the current application's load capacity and VPS hosting recommendations for MVP/production deployment.

## Table of Contents
- [Current Load Capacity](#current-load-capacity)
- [System Bottlenecks](#system-bottlenecks)
- [VPS Hosting Recommendations](#vps-hosting-recommendations)
- [Scaling Guidelines](#scaling-guidelines)

---

## Current Load Capacity

### Architecture Overview
The application runs on a containerized architecture with:
- **App Container**: Next.js 16 application (standalone mode)
- **Worker Container**: BullMQ job processor for file processing
- **Redis**: Job queue and caching
- **Qdrant**: Vector database for RAG
- **MongoDB Atlas**: Primary database (M0 free tier)

### Capacity Estimates

#### Conservative Estimates (Current Configuration)

| Metric | Capacity | Limiting Factor |
|--------|----------|-----------------|
| **Concurrent Users** | 200-500 | MongoDB connections + Rate limits |
| **Chat Messages/Hour** | 50,000-100,000 | Session rate limits (50 msg/hr/session) |
| **API Requests/Second** | 20-50 | MongoDB pool (10 connections) |
| **File Uploads/Hour** | 300 | Worker concurrency (5 jobs) |
| **Daily Active Users** | 2,000-5,000 | Combined limits |

#### Peak Capacity (Burst Traffic)

| Metric | Peak Capacity |
|--------|---------------|
| **Peak Concurrent Users** | 800-1,000 |
| **Peak Requests/Second** | 100 |
| **Peak Messages/Hour** | 150,000 |

### Configuration Constraints

#### 1. Rate Limiting
```javascript
// Current settings (src/lib/utils/rateLimit.js)
IP-based:      100 requests/hour per IP
Session-based: 50 messages/hour per session
Storage:       In-memory Map (not distributed)
```

**Limitation**: In-memory storage doesn't persist across restarts or scale across multiple instances.

#### 2. Database Connections
```javascript
// MongoDB configuration (src/lib/integrations/mongo.js)
maxPoolSize: 10 connections
serverSelectionTimeoutMS: 5000ms
socketTimeoutMS: 45000ms
```

**Limitation**: MongoDB Atlas M0 free tier limits total connections to ~100 concurrent.

#### 3. Worker Queue
```javascript
// BullMQ configuration (src/lib/queues/config.js)
concurrency: 5 jobs
max: 10 jobs/second
retries: 3 attempts per job
```

**Limitation**: Only 5 files can be processed simultaneously.

#### 4. OpenAI Integration
```javascript
timeout: 30000ms (30 seconds)
```

**Limitation**: Subject to OpenAI's rate limits (typically 3,500 req/min for paid tier).

---

## System Bottlenecks

Ordered by severity and impact:

### 🔴 Critical Bottlenecks

#### 1. MongoDB Atlas M0 Free Tier
- **Limit**: ~100 total concurrent connections
- **Current Pool**: 10 connections
- **Impact**: Can only handle 10 concurrent database operations
- **Recommendation**: Upgrade to M10 ($57/month) for production

#### 2. Single App Container
- **Limit**: No horizontal scaling configured
- **Impact**: Single point of failure, limited to single CPU core
- **Recommendation**: Deploy multiple app replicas with load balancer

### 🟡 Medium Bottlenecks

#### 3. In-Memory Rate Limiting
- **Issue**: Doesn't work with multiple instances, loses state on restart
- **Impact**: Can't scale horizontally with current implementation
- **Recommendation**: Migrate to Redis-based rate limiting

#### 4. Worker Concurrency
- **Current**: 5 concurrent jobs
- **Impact**: Large file uploads can block queue
- **Recommendation**: Increase to 10-20 jobs for better throughput

### 🟢 Minor Bottlenecks

#### 5. OpenAI API Limits
- **Issue**: Users' custom keys have their own rate limits
- **Impact**: Depends on user's OpenAI tier
- **Mitigation**: Global fallback key configured

---

## VPS Hosting Recommendations

### 🎯 Recommended for MVP: 4GB RAM / 2 vCPU

#### Best Options

| Provider | Plan | Specs | Price/Month | Recommended |
|----------|------|-------|-------------|-------------|
| **Hetzner** | CX21 | 2 vCPU, 4GB RAM, 40GB SSD | €5.83 (~$6.50) | ✅ Best Value |
| **DigitalOcean** | Basic Droplet | 2 vCPU, 4GB RAM, 80GB SSD | $24 | ✅ Best Support |
| **Linode** | Shared 4GB | 2 vCPU, 4GB RAM, 80GB SSD | $24 | Good |
| **Vultr** | Regular | 2 vCPU, 4GB RAM, 80GB SSD | $24 | Good |

#### Memory Allocation (4GB VPS)

```
App Container:      ~300-400 MB
Worker Container:   ~200-300 MB
Redis Container:    ~50-100 MB
Qdrant Container:   ~200-400 MB
OS (Ubuntu):        ~400-500 MB
Buffer:             ~1.5-2 GB
--------------------------------
Total:              ~3-3.5 GB ✅
```

#### Capacity with 4GB VPS

- **Concurrent Users**: 100-300
- **Daily Active Users**: 500-1,000
- **Chat Messages/Hour**: 10,000-20,000
- **File Uploads/Hour**: 50-100
- **Peak Requests/Second**: 20-40

**Suitable for:**
- MVP testing with beta users
- Demo presentations
- 50-200 daily active testers
- Light production traffic

### 💡 Top Pick: Hetzner CX21

**Why Hetzner:**
- **Best price**: €5.83/month (~$6.50)
- European data centers (Germany/Finland)
- Good global latency (~100-150ms to India)
- Excellent uptime and reliability
- Easy upgrade path to CX31 (8GB)

**Region Selection:**
- Use **Hetzner Finland** or **Germany** for global reach
- Or use **DigitalOcean Bangalore** for Indian users (~10-20ms latency)

### ⚠️ Minimum (Not Recommended): 2GB RAM

Only if extreme budget constraint:
- **Hetzner CX11**: 1 vCPU, 2GB RAM - €3.79/month (~$4.20)

**Issues:**
- Containers may experience OOM (Out of Memory) kills
- Need to add swap space (degrades performance)
- Struggles with file processing
- Not suitable for >50 concurrent users

### 🚀 Production Ready: 8GB RAM / 4 vCPU

When ready to scale:
- **Hetzner CX31**: 2 vCPU, 8GB RAM - €11.66/month (~$13)
- **DigitalOcean**: 4 vCPU, 8GB RAM - $48/month

**Capacity:**
- 500-1,000 concurrent users
- 5,000-10,000 daily active users
- Can run 2 app replicas with load balancer

---

## Scaling Guidelines

### Storage Requirements

| Component | Space Required |
|-----------|---------------|
| Docker images | 1-2 GB |
| Qdrant vectors | ~500 MB per 10,000 documents |
| Redis persistence | 100-500 MB |
| Application logs | 1-2 GB |
| **Minimum SSD** | **40GB** |

### To Handle 10,000+ Concurrent Users

#### Infrastructure Changes Required:

1. **Database Upgrade**
   - MongoDB Atlas M10 ($57/month) or higher
   - Connection pool: 50-100 connections
   - Provides 100x capacity increase

2. **Horizontal Scaling**
   - Deploy 3-5 app replicas
   - Add Nginx/Traefik load balancer
   - Use Docker Swarm or Kubernetes

3. **Distributed Rate Limiting**
   - Migrate from in-memory to Redis-based
   - Implement sliding window algorithm
   - Add distributed session management

4. **Worker Pool Expansion**
   - Increase concurrency: 5 → 20 jobs
   - Add dedicated worker instances
   - Implement priority queues

5. **Caching Layer**
   - Add Redis cache for bot configs
   - Cache API key lookups (already implemented)
   - Cache conversation history (last N messages)

6. **CDN Integration**
   - Serve static assets via CloudFront/Cloudflare
   - Cache embed.js and public files
   - Reduce server load by 60-70%

### Cost Breakdown

#### MVP/Testing (100-500 users)
```
VPS (Hetzner CX21):           $6.50/month
MongoDB Atlas M0:             FREE
AWS S3 (light usage):         $1-2/month
Domain + SSL (optional):      $1/month
-------------------------------------------
Total:                        ~$8-10/month
```

#### Production (1,000-5,000 users)
```
VPS (2x Hetzner CX31):        $26/month
Load Balancer:                $12/month
MongoDB Atlas M10:            $57/month
AWS S3:                       $5-10/month
Cloudflare (free tier):       FREE
Domain + SSL:                 $1/month
-------------------------------------------
Total:                        ~$100-110/month
```

#### Scale Production (10,000+ users)
```
VPS (5x CX41):                $125/month
Load Balancer:                $12/month
MongoDB Atlas M30:            $285/month
AWS S3:                       $20-30/month
Cloudflare Pro:               $20/month
Monitoring (DataDog):         $15/month
-------------------------------------------
Total:                        ~$480-500/month
```

---

## Quick Start Deployment

### 1. Initial VPS Setup

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version
```

### 2. Deploy Application

```bash
# Clone repository
git clone https://github.com/yourusername/plugRag.git
cd plugRag

# Build and start containers
docker compose up -d --build

# Check container status
docker compose ps

# View logs
docker compose logs -f app
```

### 3. Configure Firewall

```bash
# Allow HTTP/HTTPS and SSH
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 4. Setup Domain & SSL (Optional)

```bash
# Install Nginx and Certbot
apt install nginx certbot python3-certbot-nginx -y

# Configure reverse proxy (see DEPLOYMENT.md for details)
# Obtain SSL certificate
certbot --nginx -d yourdomain.com
```

---

## Monitoring & Maintenance

### Key Metrics to Monitor

1. **Container Health**
   ```bash
   docker stats
   docker compose ps
   ```

2. **Memory Usage**
   ```bash
   free -h
   docker stats --no-stream
   ```

3. **Disk Space**
   ```bash
   df -h
   docker system df
   ```

4. **Application Logs**
   ```bash
   docker compose logs -f --tail 100
   ```

### Cleanup & Optimization

```bash
# Clean unused Docker resources
docker system prune -a

# Remove old logs
docker compose logs --tail 1000 > backup.log
docker compose down
docker compose up -d

# Monitor Qdrant storage
docker exec plugrag-qdrant ls -lh /qdrant/storage
```

---

## FAQ

### Q: Can I run this on AWS Free Tier?
**A:** Yes, but t2.micro (1GB RAM) will struggle. Use t2.small (2GB) minimum. Free tier is limited to 750 hours/month.

### Q: Should I use managed services?
**A:** For MVP, use:
- ✅ MongoDB Atlas (free M0)
- ✅ AWS S3 (pay-as-you-go)
- ❌ Avoid managed Redis/Qdrant (expensive)

### Q: How do I backup the database?
**A:** MongoDB Atlas has automatic backups. For Qdrant vectors:
```bash
docker exec plugrag-qdrant tar -czf /backup.tar.gz /qdrant/storage
docker cp plugrag-qdrant:/backup.tar.gz ./qdrant-backup.tar.gz
```

### Q: What about serverless deployment?
**A:** Not recommended due to:
- Qdrant requires persistent storage
- Worker processes need long-running containers
- Better suited for VPS/container deployment

---

## Resources

- [Deployment Guide](./DEPLOYMENT.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [API Reference](./API-REFERENCE.md)
- [Docker Documentation](https://docs.docker.com/)
- [Hetzner Cloud Docs](https://docs.hetzner.com/)

---

**Last Updated**: January 10, 2026  
**Application Version**: 0.1.0
