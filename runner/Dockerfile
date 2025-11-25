# ==============================================================================
# Stage 1: Build Stage
# Compile TypeScript and prepare dependencies
# ==============================================================================
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# ==============================================================================
# Stage 2: Runtime Stage
# Create minimal runtime image with Node.js + Java (for test execution)
# ==============================================================================
FROM node:18-alpine AS runtime

# Install OpenJDK 17, Maven, and tini (required for PIT test execution and proper init)
RUN apk add --no-cache \
    openjdk17 \
    maven \
    tini \
    && rm -rf /var/cache/apk/*

# Set Java environment variables
ENV JAVA_HOME=/usr/lib/jvm/default-jvm
ENV PATH="${JAVA_HOME}/bin:${PATH}"

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 runner && \
    adduser -D -u 1001 -G runner runner

# Copy package files
COPY --chown=runner:runner package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy compiled code from builder
COPY --from=builder --chown=runner:runner /app/dist ./dist

# Copy PIT configurations
COPY --chown=runner:runner pits ./pits

# Create directories for runtime (tmp, work, logs)
RUN mkdir -p ./tmp ./work ./logs && \
    chown -R runner:runner ./tmp ./work ./logs

# Switch to non-root user
USER runner

# Health check - checks if Node.js process is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD ps aux | grep "node.*main.js" || exit 1

# Use tini as init system to properly handle signals
ENTRYPOINT ["/sbin/tini", "--"]

# Start the runner (TypeScript compiles src/main.ts to dist/main.js)
CMD ["node", "dist/main.js"]
