# Multi-stage Dockerfile for plugRag Application
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --omit=dev --legacy-peer-deps && \
    npm cache clean --force

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Accept build arguments for environment variables
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL
ARG CLERK_SECRET_KEY
ARG MONGODB_URI
ARG ENCRYPTION_SECRET_KEY
ARG OPENAI_API_KEY
ARG AWS_ACCESS_KEY_ID
ARG AWS_SECRET_ACCESS_KEY
ARG AWS_REGION
ARG AWS_S3_BUCKET

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including dev)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build Next.js application with minimal static generation
# Set environment variables to production mode
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Set environment variables from build args for the build process
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
ENV MONGODB_URI=${MONGODB_URI}
ENV ENCRYPTION_SECRET_KEY=${ENCRYPTION_SECRET_KEY}
ENV OPENAI_API_KEY=${OPENAI_API_KEY}
ENV AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
ENV AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
ENV AWS_REGION=${AWS_REGION}
ENV AWS_S3_BUCKET=${AWS_S3_BUCKET}
ENV REDIS_HOST=localhost
ENV REDIS_PORT=6379
ENV QDRANT_URL=http://localhost:6333

# Build the application
RUN npm run build -- --no-lint || npm run build

# Stage 3: Runner (Production)
FROM node:20-alpine AS runner
WORKDIR /app

# Set environment to production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/start-worker.js ./start-worker.js

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Set proper permissions
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start Next.js application
CMD ["node", "server.js"]
