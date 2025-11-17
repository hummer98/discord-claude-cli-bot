#!/bin/sh
# Entrypoint script for Discord-Claude Bot
# Sets up Claude Code credentials from environment variables

set -e

# Setup Claude Code credentials if CLAUDE_CODE_OAUTH_TOKEN is provided
if [ -n "$CLAUDE_CODE_OAUTH_TOKEN" ]; then
    echo "Setting up Claude Code OAuth credentials..."

    # Create Claude config directory if it doesn't exist
    mkdir -p ~/.claude

    # Write credentials.json with OAuth token
    # The token should be in format: sk-ant-oat01-...
    cat > ~/.claude/credentials.json <<EOF
{
  "access_token": "$CLAUDE_CODE_OAUTH_TOKEN",
  "refresh_token": "",
  "expires_at": 0
}
EOF

    echo "Claude Code OAuth credentials configured"
fi

# Execute the main application
exec "$@"
