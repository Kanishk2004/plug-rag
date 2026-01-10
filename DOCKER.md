# Docker Deployment Guide

This guide explains how to deploy the plugRag application using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 2GB of available RAM
- Environment variables configured (see below)

## Quick Start

### 1. Environment Setup

Create a `.env.local` file from the example:

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your actual values:

```env
MONGODB_URI=mongodb+srv://your-cluster.mongodb.net/plugrag
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
ENCRYPTION_SECRET_KEY=your-32-character-secret-key!!
OPENAI_API_KEY=sk-...
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
```

### 2. Build and Run

**Development Mode (Local Services Only):**
```bash
# Start Redis and Qdrant only
docker-compose up redis qdrant -d

# Run app locally
npm run dev

# Run worker locally (in another terminal)
npm run worker
```

**Production Mode (All Services):**
```bash
# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f app
docker-compose logs -f worker
```

### 3. Access the Application

- Application: http://localhost:3000
- Qdrant Dashboard: http://localhost:6333/dashboard
- Redis: localhost:6379

## Architecture

The Docker setup includes 4 services:

1. **redis** - BullMQ job queue for file processing
2. **qdrant** - Vector database for RAG functionality
3. **app** - Next.js application (main web server)
4. **worker** - Background worker for file processing

## Docker Files

### Dockerfile
Multi-stage build for the Next.js application:
- **deps**: Production dependencies
- **builder**: Builds the Next.js app
- **runner**: Final production image (optimized size)

### Dockerfile.worker
Separate container for the background worker process that handles file uploads and vector processing.

### .dockerignore
Excludes unnecessary files from the Docker build context to speed up builds.

## Commands

### Start Services
```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up app -d

# Start with build
docker-compose up --build -d
```

### Stop Services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (CAUTION: Deletes data)
docker-compose down -v
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f worker
docker-compose logs -f redis
docker-compose logs -f qdrant
```

### Rebuild Services
```bash
# Rebuild all
docker-compose build

# Rebuild specific service
docker-compose build app
docker-compose build worker

# Force rebuild without cache
docker-compose build --no-cache
```

### Execute Commands in Container
```bash
# Access app container shell
docker-compose exec app sh

# Access worker container shell
docker-compose exec worker sh

# Run Node.js command in app
docker-compose exec app node -v
```

### Health Checks
```bash
# Check service health
docker-compose ps

# Test app health endpoint
curl http://localhost:3000/api/health
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://...` |
| `CLERK_SECRET_KEY` | Clerk authentication secret | `sk_live_...` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | `pk_live_...` |
| `ENCRYPTION_SECRET_KEY` | 32-char encryption key | `abcdef1234567890...` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `AWS_ACCESS_KEY_ID` | AWS access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `...` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `AWS_S3_BUCKET` | S3 bucket name | `my-bucket` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis hostname | `redis` |
| `REDIS_PORT` | Redis port | `6379` |
| `QDRANT_URL` | Qdrant URL | `http://qdrant:6333` |
| `NEXT_PUBLIC_APP_URL` | Public app URL | `http://localhost:3000` |

## Volumes

Persistent data is stored in Docker volumes:

- `redis_data` - Redis persistence (job queue data)
- `qdrant_storage` - Qdrant vector database storage

### Backup Volumes
```bash
# Backup Qdrant data
docker run --rm -v plugrag_qdrant_storage:/data -v $(pwd):/backup alpine tar czf /backup/qdrant-backup.tar.gz -C /data .

# Backup Redis data
docker run --rm -v plugrag_redis_data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz -C /data .
```

### Restore Volumes
```bash
# Restore Qdrant data
docker run --rm -v plugrag_qdrant_storage:/data -v $(pwd):/backup alpine sh -c "cd /data && tar xzf /backup/qdrant-backup.tar.gz"

# Restore Redis data
docker run --rm -v plugrag_redis_data:/data -v $(pwd):/backup alpine sh -c "cd /data && tar xzf /backup/redis-backup.tar.gz"
```

## Troubleshooting

### Container Won't Start

1. Check logs:
```bash
docker-compose logs app
```

2. Verify environment variables:
```bash
docker-compose config
```

3. Check container status:
```bash
docker-compose ps
```

### Out of Memory

Increase Docker memory limit in Docker Desktop settings to at least 4GB.

### Permission Errors

The containers run as non-root users (`nextjs` and `worker`). If you encounter permission issues with volumes, check volume permissions.

### Port Already in Use

If ports 3000, 6379, or 6333 are already in use, modify the port mappings in `docker-compose.yaml`:

```yaml
ports:
  - "3001:3000"  # Map host port 3001 to container port 3000
```

### Worker Not Processing Files

1. Check worker logs:
```bash
docker-compose logs -f worker
```

2. Verify Redis connection:
```bash
docker-compose exec worker sh
# Inside container:
ping redis
```

3. Check environment variables are set correctly.

## Production Deployment

For production deployment:

1. Use a managed MongoDB instance (MongoDB Atlas)
2. Use external Redis/Qdrant or managed services
3. Set proper domain in `NEXT_PUBLIC_APP_URL`
4. Use secure secrets (not example values)
5. Set up SSL/TLS termination (reverse proxy like nginx)
6. Configure proper backup strategies
7. Monitor logs and metrics
8. Set resource limits in docker-compose:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## Scaling

### Scale Workers
```bash
# Run 3 worker instances
docker-compose up -d --scale worker=3
```

### Load Balancing
For horizontal scaling of the app service, use a reverse proxy (nginx, Traefik) or deploy to container orchestration platforms (Kubernetes, ECS, etc.).

## Security Notes

- Never commit `.env.local` to version control
- Use strong, unique values for `ENCRYPTION_SECRET_KEY`
- Rotate API keys regularly
- Use secrets management in production (AWS Secrets Manager, HashiCorp Vault, etc.)
- Run containers as non-root users (already configured)
- Keep base images updated
- Scan images for vulnerabilities: `docker scan plugrag-app`

## Performance Optimization

1. **Multi-stage builds** - Already implemented to minimize image size
2. **Layer caching** - Dependencies cached separately from source code
3. **Alpine Linux** - Using Alpine-based images for smaller size
4. **Health checks** - Implemented for proper orchestration
5. **Resource limits** - Set appropriate limits in production

## Monitoring

Consider adding monitoring tools:

```yaml
# Add to docker-compose.yaml
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
```

## License

See LICENSE file in the project root.
