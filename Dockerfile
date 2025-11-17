# Multi-stage build for Discord-Claude Bot
# Stage 1: Build
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:22-slim

# Install git CLI and Claude Code CLI
RUN apt-get update && \
    apt-get install -y git curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally (latest version)
RUN npm install -g @anthropic-ai/claude-code@latest

# Setup non-interactive Claude Code environment
# This is the same mechanism used by GitHub Actions
RUN mkdir -p /root/.claude && \
    echo '{"hasCompletedOnboarding": true, "theme": "dark", "defaultModel": "claude-sonnet-4-5-20250929", "trustedFolders": ["/app"]}' > /root/.claude.json

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user first
RUN useradd -m -u 1000 -o botuser

# Create directories for logs, repository, and scripts
RUN mkdir -p /app/logs /app/repo /app/scripts && \
    chown -R botuser:botuser /app

# Setup Claude config for botuser
RUN mkdir -p /home/botuser/.claude && \
    cp /root/.claude.json /home/botuser/.claude.json && \
    chown -R botuser:botuser /home/botuser/.claude*

USER botuser

# Expose no ports (Discord bot uses WebSocket outbound connections only)

# Health check (optional: check if process is running)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD pgrep -f "node dist/index.js" || exit 1

# Start the bot
CMD ["node", "dist/index.js"]
