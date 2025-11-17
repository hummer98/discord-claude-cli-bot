/**
 * MessageHandler Service
 * Handles incoming Discord messages and routes them appropriately
 */

import { Message, ThreadChannel } from 'discord.js';
import { DiscordClient } from './DiscordClient';
import { Logger } from '../logger/Logger';

export interface Command {
  type: 'status' | 'chat';
  content: string;
  message: Message;
  thread?: ThreadChannel;
}

type CommandHandler = (command: Command) => Promise<void>;

export class MessageHandler {
  private commandHandler?: CommandHandler;

  constructor(
    private discordClient: DiscordClient,
    private logger: Logger
  ) {}

  /**
   * Check if message mentions the bot
   */
  isBotMention(message: Message): boolean {
    const botUser = this.discordClient.getUser();
    if (!botUser) {
      return false;
    }
    return message.mentions.has(botUser.id);
  }

  /**
   * Parse command from message
   * Returns null if message should not be processed
   */
  parseCommand(message: Message): Command | null {
    const isThread = message.channel.isThread();
    const isMention = this.isBotMention(message);

    // Ignore non-mention messages in regular channels
    if (!isThread && !isMention) {
      return null;
    }

    // Check for status command
    const content = message.content.toLowerCase().trim();
    if (content.includes('status')) {
      const command: Command = {
        type: 'status',
        content: message.content,
        message,
      };
      if (isThread) {
        command.thread = message.channel as ThreadChannel;
      }
      return command;
    }

    // Default to chat command
    const command: Command = {
      type: 'chat',
      content: message.content,
      message,
    };
    if (isThread) {
      command.thread = message.channel as ThreadChannel;
    }
    return command;
  }

  /**
   * Handle incoming message
   */
  async handleMessage(message: Message): Promise<void> {
    // Ignore bot messages (including self)
    if (message.author.bot) {
      this.logger.debug('Ignoring bot message', {
        messageId: message.id,
        authorId: message.author.id,
      });
      return;
    }

    // Parse command
    const command = this.parseCommand(message);
    if (!command) {
      this.logger.debug('Message does not require processing', {
        messageId: message.id,
        channelId: message.channel.id,
      });
      return;
    }

    // Log message processing
    this.logger.info('Processing message', {
      messageId: message.id,
      userId: message.author.id,
      username: message.author.username,
      channelId: message.channel.id,
      commandType: command.type,
    });

    // Execute command handler
    if (this.commandHandler) {
      try {
        await this.commandHandler(command);
      } catch (error) {
        this.logger.error(
          'Error handling message',
          error instanceof Error ? error : new Error(String(error)),
          {
            messageId: message.id,
            userId: message.author.id,
            commandType: command.type,
          }
        );
      }
    } else {
      this.logger.warn('No command handler set', {
        messageId: message.id,
        commandType: command.type,
      });
    }
  }

  /**
   * Set the command handler callback
   */
  setCommandHandler(handler: CommandHandler): void {
    this.commandHandler = handler;
  }
}
