# Discord Claude CLI Bot

English | [日本語](./README.ja.md)

A Discord bot system integrated with Claude Code CLI. Interact with Claude AI on Discord by mentioning the bot, with support for threaded conversations to maintain context.

## Features

- **Discord Integration**: Natural interaction with Claude via @mentions
- **Thread Support**: Continuous conversations with preserved history
- **Git Sync**: Automatic repository synchronization to keep the bot up-to-date
- **Docker Ready**: Works anywhere - local, cloud, or VPS
- **Easy Setup**: One-command deployment with docker-compose

## Architecture

### Deployment Environments

```
Docker-compatible Environment (Local/Cloud/VPS)
└── Docker Container
    ├── Discord Bot (discord.js)
    ├── Claude Code CLI Integration
    └── Git Sync Feature
```

**Supported Environments**:
- **Local**: macOS/Linux/Windows+WSL2
- **Cloud**: AWS ECS/Fargate, Google Cloud Run, Azure Container Instances
- **VPS**: ConoHa, Sakura VPS, any Docker-compatible VPS
- **PaaS**: Railway, Render, Fly.io

**Important**: Discord Bot only uses WebSocket connections (outbound), so no external access is required. Port exposure is not necessary.

### Authentication Methods

- **Discord**: Bot Token
- **Claude**: OAuth Token Method
  - **Recommended**: OAuth Token (`CLAUDE_CODE_OAUTH_TOKEN`) - Requires Claude Pro/Max subscription
  - **Alternative**: API Key (`ANTHROPIC_API_KEY`) - Pay-as-you-go
- **GitHub**: Personal Access Token (for private repositories)

This bot uses **Claude Code CLI** and works with the same authentication method in any environment.

## Prerequisites

### Container Runtime (choose one)

- **Docker**: Docker Engine + Docker Compose (Linux/Cloud) or Docker Desktop (macOS/Windows)
- **Podman (Recommended)**: Open-source container runtime
  - macOS: `brew install podman`
  - Linux: Install via package manager

### Development Tools (Optional)

- **Task**: Task runner (convenient for local development)
  - macOS: `brew install go-task/tap/go-task`
  - Linux: [Taskfile installation](https://taskfile.dev/installation/)
- **Node.js 22+**: Required for local development (not needed for container-only deployment)
- **Git**: Version control

### Running Environment

- **24/7 Available Environment**:
  - Local PC (always-on)
  - Cloud (AWS/GCP/Azure, etc.)
  - VPS (ConoHa/Sakura, etc.)
  - PaaS (Railway/Render/Fly.io, etc.)

> **Recommended**: Use `task doctor` to check your environment during local development

### Required Tokens

1. **Discord Bot Token**
   - Create an application at [Discord Developer Portal](https://discord.com/developers/applications)
   - Generate a token in the Bot tab
   - Set `bot` scope + required permissions in OAuth2 → URL Generator
   - Invite to your server using the generated URL

2. **Claude Authentication** (choose one)

   **Option A: OAuth Token (Recommended)**
   - Requires Claude Pro/Max subscription
   - Token retrieval steps:
     ```bash
     # Install Claude Code CLI (run in any environment)
     npm install -g @anthropic-ai/claude-code

     # OAuth authentication
     claude auth login

     # Generate OAuth token
     claude setup-token
     # → Copy CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-xxxxx
     ```

   **Option B: API Key (Pay-as-you-go)**
   - Generate an API key at [Anthropic Console](https://console.anthropic.com/)
   - Separate pay-as-you-go from Claude Pro subscription

3. **GitHub Token** (Optional)
   - Only required for syncing private repositories
   - Token retrieval steps:
     ```bash
     # Install GitHub CLI (run in any environment)
     # macOS
     brew install gh
     # Linux/WSL
     sudo apt install gh

     # GitHub authentication (first time only)
     gh auth login

     # Get token
     gh auth token
     # → Copy ghp_xxxxx
     ```
   - Or manually generate at [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
   - Select `repo` scope

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/discord-claude-cli-bot.git
cd discord-claude-cli-bot
```

### 2. Obtain Authentication Tokens

**Important**: Token retrieval can be done in any environment (e.g., local PC). Once you have the tokens, you can set them as environment variables and run the bot anywhere.

```bash
# Install Claude Code CLI (for Claude authentication)
npm install -g @anthropic-ai/claude-code

# Claude authentication (OAuth Token - Recommended)
claude auth login
claude setup-token
# → Note the output CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-xxxxx

# Install GitHub CLI (recommended, for GitHub authentication)
# macOS
brew install gh
# Linux/WSL
sudo apt install gh

# GitHub authentication (for private repositories)
gh auth login
gh auth token
# → Note the output ghp_xxxxx
```

### 3. Clone and Setup Project

Run the following in your deployment environment:

```bash
# Clone repository
git clone https://github.com/yourusername/discord-claude-cli-bot.git
cd discord-claude-cli-bot
```

### 4. Configure Environment Variables

```bash
# Create .env.docker file
cp .env.docker.example .env.docker
```

Edit the `.env.docker` file:

```bash
# Required: Discord Bot Token (from Discord Developer Portal)
DISCORD_BOT_TOKEN=your_discord_bot_token_here

# Required: Git repository
GIT_REPOSITORY_URL=https://github.com/username/repo.git

# Required: Claude authentication (choose one)
# Option A: OAuth Token (recommended, from claude setup-token)
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-xxxxxxxxxxxxx

# Option B: API Key (pay-as-you-go, from Anthropic Console)
# ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# Optional: GitHub authentication (from gh auth token, for private repos)
GITHUB_TOKEN=ghp_xxxxx

# Optional: Log level
LOG_LEVEL=info          # debug, info, warn, error
```

### 5. Verify Environment (Optional)

**For local development (using Podman + Task)**:

```bash
# Check required software and project settings
task doctor
```

**For Docker**:

```bash
# Verify Docker is properly installed
docker --version
docker-compose --version
```

### 6. Start the Bot

**Using Podman + Task (Recommended)**:

```bash
# Build image and start
task dev:build

# View logs
task logs:follow
```

**Using Docker**:

```bash
# Start in background
docker-compose up -d

# View logs
docker-compose logs -f discord-bot
```

### 7. Try it on Discord

In your Discord server:

```
@ClaudeBot Hello!
```

The bot will automatically create a thread and respond. You can continue the conversation in the thread without @mentioning.

## Setup Summary

Complete setup flow:

```bash
# 1. Obtain authentication tokens (run in any environment, first time only)
npm install -g @anthropic-ai/claude-code
claude auth login && claude setup-token  # → Note CLAUDE_CODE_OAUTH_TOKEN

# GitHub CLI (for private repositories)
brew install gh  # macOS or sudo apt install gh  # Linux
gh auth login && gh auth token           # → Note GITHUB_TOKEN

# 2. Clone project in deployment environment
git clone https://github.com/yourusername/discord-claude-cli-bot.git
cd discord-claude-cli-bot

# 3. Configure environment variables
cp .env.docker.example .env.docker
# Edit .env.docker file to set tokens

# 4. Start with Docker
# Using Podman + Task
task dev:build
task logs:follow

# Using Docker Compose
docker-compose up -d
docker-compose logs -f discord-bot
```

## Usage

### Basic Interaction

```
# Start a new conversation in a channel (creates a thread)
@ClaudeBot Implement FizzBuzz in TypeScript

# Continue conversation in thread (no @mention needed)
Can you make it simpler?
```

### Status Check

```
@ClaudeBot status
```

Displays:
- Git branch and status
- Bot uptime
- (Future) API usage

### Git Sync

The bot automatically syncs the Git repository when creating new threads. You'll be notified of any updates.

## Directory Structure

```
discord-claude-cli-bot/
├── .env.docker             # Docker environment variables (.gitignore)
├── .env.docker.example     # Template for Docker env vars
├── docker-compose.yml      # Docker Compose configuration
├── Dockerfile             # Docker image definition
├── package.json           # Node.js dependencies
├── tsconfig.json          # TypeScript configuration
├── src/                   # Source code
│   ├── index.ts          # Entry point
│   ├── adapters/         # External service integrations
│   │   ├── discord-adapter.ts
│   │   ├── claude-adapter.ts
│   │   ├── git-adapter.ts
│   │   └── config-adapter.ts
│   ├── domain/           # Core business logic
│   │   ├── message-handler.ts
│   │   ├── thread-manager.ts
│   │   └── bot-orchestrator.ts
│   └── infrastructure/   # Infrastructure layer
│       └── logger.ts
├── volumes/              # Docker persistent data (.gitignore)
│   ├── logs/            # Log files
│   ├── repo/            # Git repository
│   └── claude/          # Claude credentials (when using OAuth)
└── docs/                # Documentation
    ├── BOOT.md
    └── SETUP_CLAUDE_CLI.md
```

## Development

### Environment Check

```bash
# Verify required software and project settings
task doctor
```

### Local Development Environment

```bash
# Install dependencies
npm install

# Development mode (hot reload)
npm run dev

# Build
npm run build

# Production mode
npm start
```

### Container Build

**Using Podman + Task (Recommended)**:

```bash
# Build image
task build

# Force rebuild without cache
task build:nocache

# Build and start
task dev:build

# Complete rebuild and restart
task dev:rebuild
```

**Using Docker**:

```bash
# Build image
docker-compose build

# Force rebuild
docker-compose build --no-cache

# Restart container
docker-compose restart discord-bot
```

### View Logs

**Using Podman + Task (Recommended)**:

```bash
# Real-time logs
task logs:follow

# Show logs
task logs

# Show last 100 lines
task logs:tail

# File logs (local)
tail -f volumes/logs/discord-bot-*.log
```

**Using Docker**:

```bash
# Real-time logs
docker-compose logs -f discord-bot

# File logs (local)
tail -f volumes/logs/discord-bot-*.log

# Last 100 lines
docker-compose logs --tail=100 discord-bot
```

### Other Useful Commands (Task)

```bash
# Check container status
task ps

# Resource usage
task stats

# Start shell in container
task shell

# Execute command in container
task exec -- node --version

# Check environment variables
task env:check
```

## Operations

### Start/Stop

**Using Podman + Task (Recommended)**:

```bash
# Start
task up

# Stop
task stop

# Restart
task restart

# Stop and remove
task down

# Complete cleanup
task clean

# Remove unused resources
task prune
```

**Using Docker**:

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart
docker-compose restart

# Complete removal (including volumes)
docker-compose down -v
```

### Updates

**Using Podman + Task (Recommended)**:

```bash
# Update code
git pull origin main

# Rebuild and restart
task dev:rebuild
```

**Using Docker**:

```bash
# Update code
git pull origin main

# Rebuild and restart
docker-compose up -d --build
```

### Log Rotation

Logs are automatically rotated:
- **Daily rotation**: Keep up to 7 days
- **Size rotation**: New file when exceeding 10MB
- **Auto compression**: Old logs are gzip compressed

### Troubleshooting

#### Bot doesn't start

```bash
# Check logs
docker-compose logs discord-bot

# Check container status
docker-compose ps

# Check environment variables
docker-compose config
```

#### Authentication errors

```
Error: Invalid Discord token
```

→ Check `DISCORD_BOT_TOKEN` in `.env.docker`

```
Error: Invalid Anthropic API key
```

→ Check `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` in `.env.docker`

#### Git sync errors

```bash
# Check GitHub token permissions
# GITHUB_TOKEN is required for private repositories

# Manually test Git operations
docker exec -it discord-claude-cli-bot bash
cd /app/repo
git fetch
git status
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISCORD_BOT_TOKEN` | ✅ | - | Discord Bot Token |
| `CLAUDE_CODE_OAUTH_TOKEN` | ⚠️ | - | Claude OAuth Token (recommended) |
| `ANTHROPIC_API_KEY` | ⚠️ | - | Anthropic API key (alternative) |
| `GIT_REPOSITORY_URL` | ✅ | - | Git repository URL to sync |
| `GITHUB_TOKEN` | ❌ | - | GitHub access token (for private repos) |
| `LOG_LEVEL` | ❌ | `info` | Log level (debug/info/warn/error) |
| `LOG_TO_FILE` | ❌ | `true` | Enable file logging |
| `LOG_FILE_PATH` | ❌ | `/app/logs` | Log file directory |
| `MAX_THREAD_HISTORY` | ❌ | `50` | Maximum thread history to fetch |

⚠️ Claude authentication: Either `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` is required

### Volume Mounts

```yaml
volumes:
  # Persist log files
  - ./volumes/logs:/app/logs

  # Persist Git repository
  - ./volumes/repo:/app/repo

  # Persist Claude credentials (OAuth only)
  - ./volumes/claude:/root/.claude
```

## Cost

### Cost by Deployment Environment

| Environment | Infrastructure Cost | Pros | Cons |
|-------------|---------------------|------|------|
| **Local PC** | $5-10/month electricity | Great dev experience, easy OAuth | PC must be always on |
| **VPS** (ConoHa 1GB) | ~$10/month | Stable, no electricity cost | Server management required |
| **Cloud** (AWS Fargate, etc.) | Usage-based (~$10-30/month) | Fully managed, high availability | Somewhat expensive |
| **PaaS** (Railway/Render) | Free tier or $5-10/month | Easy deployment, auto-scale | Free tier limitations |

### Common Costs

- **Claude API**: Pay-as-you-go
  - Example: 1M tokens = $3-15 (depending on model)
  - OAuth Token requires Claude Pro/Max subscription
- **Discord Bot**: Free
- **GitHub**: Free (for public repositories)

## Security

### Credential Management

- ✅ Managed via environment variables (`.env.docker` in .gitignore)
- ✅ Automatic masking in log output
- ✅ Never hardcode in source code
- ✅ Use Secrets Manager for cloud deployments

**Cloud Deployment Recommendations**:
- **AWS**: Secrets Manager / Parameter Store
- **GCP**: Secret Manager
- **Azure**: Key Vault
- **Kubernetes**: Secrets
- **PaaS**: Use each service's environment variable feature

### Log Masking

Auto-mask the following patterns:
- API keys: `ANTHROPIC_API_KEY=***`, `sk-ant-***`
- Discord tokens: `DISCORD_BOT_TOKEN=***`
- GitHub tokens: `GITHUB_TOKEN=***`, `ghp_***`

### Docker Secrets (Future)

```yaml
secrets:
  discord_token:
    file: ./secrets/discord_token.txt
  anthropic_key:
    file: ./secrets/anthropic_key.txt
```

## Task Commands

View all available tasks:

```bash
task --list
```

Main commands:

| Category | Command | Description |
|----------|---------|-------------|
| **Environment** | `task doctor` | Check required software and settings |
| **Build** | `task build` | Build image |
| | `task build:nocache` | Build without cache |
| **Start/Stop** | `task up` | Start containers |
| | `task start` | Start stopped containers |
| | `task stop` | Stop containers |
| | `task restart` | Restart containers |
| | `task down` | Stop and remove containers |
| **Logs** | `task logs` | Show logs |
| | `task logs:follow` | Follow logs in real-time |
| | `task logs:tail` | Show last 100 lines |
| **Monitoring** | `task ps` | Show container status |
| | `task stats` | Show resource usage |
| **Development** | `task dev:build` | Build and start |
| | `task dev:rebuild` | Rebuild and restart |
| | `task shell` | Start shell in container |
| | `task exec -- <cmd>` | Execute command in container |
| **Environment** | `task env:check` | Check environment variables |
| | `task env:setup` | Create .env file |
| **Cleanup** | `task clean` | Remove containers and images |
| | `task prune` | Remove unused resources |
| **Compose** | `task compose:up` | Start with Podman Compose |
| | `task compose:down` | Stop Podman Compose |

## Tech Stack

- **Runtime**: Node.js 22 LTS
- **Language**: TypeScript 5.x
- **Discord**: discord.js v14.24
- **Claude**: Claude Code CLI (GitHub Actions style)
  - `@anthropic-ai/claude-code` (global install in Docker)
- **Git**: simple-git
- **Logging**: Winston v3.x
- **Container**: Podman / Docker
- **Task Runner**: Task (go-task)

## License

MIT License

## Reference Documentation

### Others
- [Discord Bot Development Guide](https://discord.com/developers/docs)
- [Anthropic API Documentation](https://docs.anthropic.com/)

## Troubleshooting

See documents in [docs/](./docs/) directory for detailed troubleshooting.

## Support

Please report issues at [GitHub Issues](https://github.com/yourusername/discord-claude-cli-bot/issues).
