/**
 * Discord-Claude Bot Entry Point
 */

import dotenv from 'dotenv';
import { ConfigAdapter } from './adapters/config/ConfigAdapter';
import { Logger } from './services/logger/Logger';
import { DiscordClient } from './services/discord/DiscordClient';
import { MessageHandler } from './services/discord/MessageHandler';
import { ThreadManager } from './services/discord/ThreadManager';
import { ClaudeCliAdapter } from './adapters/claude/ClaudeCliAdapter';
import { GitAdapter } from './adapters/git/GitAdapter';
import { ConversationMapper } from './services/conversation/ConversationMapper';
import { ConversationService } from './services/conversation/ConversationService';
import { StatusService } from './services/status/StatusService';
import { BotOrchestrator } from './services/orchestrator/BotOrchestrator';

// Load environment variables
dotenv.config();

/**
 * Check Claude Code credentials
 */
function checkClaudeCredentials(): void {
  const hasOAuthToken = process.env['CLAUDE_CODE_OAUTH_TOKEN'];
  const hasApiKey = process.env['ANTHROPIC_API_KEY'];

  if (hasOAuthToken) {
    console.log('✓ Using CLAUDE_CODE_OAUTH_TOKEN for authentication');
  } else if (hasApiKey) {
    console.log('✓ Using ANTHROPIC_API_KEY for authentication');
  } else {
    console.log('⚠ No Claude credentials found');
    console.log('  Set CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY in .env');
  }
}

// Check Claude credentials at startup
checkClaudeCredentials();

let discordClient: DiscordClient | null = null;

/**
 * Main entry point for Discord-Claude Bot
 */
export async function main(): Promise<void> {
  // 1. Initialize ConfigAdapter and validate environment variables
  const config = new ConfigAdapter();
  const validationResult = config.validate();

  if (!validationResult.ok) {
    console.error('Configuration validation failed:');
    validationResult.error.forEach((error) => {
      console.error(`  - ${error.key}: ${error.reason}`);
    });
    process.exit(1);
  }

  // 2. Initialize Logger
  const logger = new Logger(config);
  logger.info('Discord-Claude Bot starting...', { version: '1.0.0' });

  try {
    // 3. Initialize GitAdapter
    logger.info('Initializing Git repository...');
    const gitAdapter = new GitAdapter(config, logger);
    const initResult = await gitAdapter.initializeRepository();

    if (!initResult.ok) {
      logger.error('Failed to initialize Git repository', initResult.error as Error);
      process.exit(1);
    }
    logger.info('Git repository initialized successfully');

    // 4. Initialize ClaudeCliAdapter (GitHub Actions style)
    logger.info('Initializing Claude CLI adapter (GitHub Actions style)...');
    const claudeAdapter = new ClaudeCliAdapter(config, logger);

    // 5. Initialize DiscordClient
    logger.info('Initializing Discord client...');
    discordClient = new DiscordClient(config, logger);

    // 6. Initialize ConversationMapper (needs Discord Client)
    const conversationMapper = new ConversationMapper(discordClient.getClient());

    // 7. Initialize ConversationService
    const conversationService = new ConversationService(
      conversationMapper,
      claudeAdapter,
      logger
    );

    // 8. Initialize StatusService
    const statusService = new StatusService(gitAdapter, claudeAdapter);

    // 9. Initialize ThreadManager
    const threadManager = new ThreadManager(logger);

    // 10. Initialize BotOrchestrator
    const botOrchestrator = new BotOrchestrator(
      conversationService,
      statusService,
      gitAdapter,
      threadManager,
      logger
    );

    // 11. Initialize MessageHandler
    const messageHandler = new MessageHandler(discordClient, logger);
    messageHandler.setCommandHandler((command) => botOrchestrator.processMessage(command));

    // 12. Register Discord event handlers
    discordClient.on('clientReady', () => {
      const user = discordClient!.getUser();
      logger.info('Discord bot is ready!', {
        botId: user?.id,
        botTag: user?.tag,
      });
    });

    discordClient.on('messageCreate', (message) => {
      messageHandler.handleMessage(message).catch((error) => {
        logger.error('Failed to handle message', error as Error, {
          messageId: message.id,
          channelId: message.channelId,
        });
      });
    });

    discordClient.on('error', (error) => {
      logger.error('Discord client error', error as Error);
    });

    // 13. Connect to Discord
    logger.info('Connecting to Discord...');
    await discordClient.connect();

    logger.info('Bot started successfully');

    // Setup graceful shutdown
    setupGracefulShutdown(logger);

  } catch (error) {
    logger.error('Fatal error during initialization', error as Error);
    process.exit(1);
  }
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(logger: Logger): void {
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    try {
      // Disconnect Discord client
      if (discordClient) {
        logger.info('Disconnecting Discord client...');
        discordClient.disconnect();
      }

      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error as Error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Start the bot if this is the main module
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
