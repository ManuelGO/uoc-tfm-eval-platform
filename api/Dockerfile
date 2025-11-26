# ==============================================================================
# Stage 1: Build NestJS API (TypeScript → dist/)
# ==============================================================================
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package metadata
COPY package*.json ./

# Install all dependencies (including devDeps for build)
RUN npm ci

# Copy TypeScript config and sources
COPY tsconfig.json ./
# Si tienes nest-cli.json u otros, añádelos también:
# COPY nest-cli.json ./
COPY src ./src

# Build the project (must exist in package.json)
RUN npm run build

# ==============================================================================
# Stage 2: Runtime image (minimal, production deps only)
# ==============================================================================
FROM node:18-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Copy package metadata
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JS from builder
COPY --from=builder /app/dist ./dist

# Expose API port
EXPOSE 3000

# Entrypoint: NestJS bootstrap
CMD ["node", "dist/main.js"]