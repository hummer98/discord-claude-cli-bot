/**
 * DiscordClient Service
 * Manages Discord Gateway connection and event handling
 */

import { Client, GatewayIntentBits, User, ClientEvents } from 'discord.js';
import { ConfigAdapter, ConfigKey } from '../../adapters/config/ConfigAdapter';
import { Logger } from '../logger/Logger';

export class DiscordClient {
  private client: Client;
  private startTime: number = 0;

  constructor(
    private config: ConfigAdapter,
    private logger: Logger
  ) {
    // Initialize Discord client with minimal required intents
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    // Set up error handler
    this.client.on('error', (error) => {
      this.logger.error('Discord client error', error);
    });

    // Set up clientReady handler
    this.client.on('clientReady', () => {
      const user = this.client.user;
      if (user) {
        this.logger.info('Discord bot is ready', {
          userId: user.id,
          username: user.username,
        });
      } else {
        this.logger.info('Discord bot is ready');
      }
    });
  }

  /**
   * Connect to Discord Gateway
   */
  async connect(): Promise<void> {
    this.logger.info('Connecting to Discord...');

    const token = this.config.get(ConfigKey.DISCORD_BOT_TOKEN);
    await this.client.login(token);

    // Record start time for uptime calculation
    this.startTime = Date.now();
  }

  /**
   * Disconnect from Discord
   */
  disconnect(): void {
    this.client.destroy();
    this.logger.info('Disconnected from Discord');
  }

  /**
   * Register event handler
   */
  on<K extends keyof ClientEvents>(
    event: K,
    handler: (...args: ClientEvents[K]) => void
  ): void {
    this.client.on(event, handler);
  }

  /**
   * Get the current bot user
   */
  getUser(): User | null {
    return this.client.user;
  }

  /**
   * Get bot uptime in milliseconds
   */
  getUptime(): number {
    if (this.startTime === 0) {
      return 0;
    }
    return Date.now() - this.startTime;
  }

  /**
   * Get the underlying Discord client
   */
  getClient(): Client {
    return this.client;
  }
}
