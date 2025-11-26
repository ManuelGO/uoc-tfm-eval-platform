# ==============================================================================
# Stage 1: Build NestJS API
# ==============================================================================
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and config
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src

# Build the app
RUN npm run build

# ==============================================================================
# Stage 2: Runtime image
# ==============================================================================
FROM node:18-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled code
COPY --from=builder /app/dist ./dist

# Environment defaults (can be overridden by ECS)
ENV API_PORT=3000

EXPOSE 3000

CMD ["node", "dist/main.js"]