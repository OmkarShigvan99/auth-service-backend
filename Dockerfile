# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:22-alpine AS dependencies

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# ============================================
# Stage 2: Builder
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy Prisma schema and config first (for better caching)
COPY prisma ./prisma
COPY prisma.config.ts ./

# Generate Prisma Client with placeholder DATABASE_URL
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate

# Copy TypeScript config and source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript application
RUN npm run build

# ============================================
# Stage 3: Production Runtime
# ============================================
FROM node:22-alpine

RUN apk add --no-cache dumb-init

RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

WORKDIR /app

COPY --from=dependencies --chown=appuser:nodejs /app/node_modules ./node_modules

COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/generated ./dist/generated

COPY --chown=appuser:nodejs prisma ./prisma
COPY --chown=appuser:nodejs prisma.config.ts ./
COPY --chown=appuser:nodejs package.json ./
COPY --chown=appuser:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER appuser

EXPOSE 3000
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', r => { if (r.statusCode !== 200) throw new Error(r.statusCode) })"

ENTRYPOINT ["dumb-init", "./docker-entrypoint.sh"]
