/**
 * ThreadManager Service
 * Manages Discord thread creation, message history, and sending
 */

import { Message, ThreadChannel } from 'discord.js';
import { Logger } from '../logger/Logger';
import { Result, ok, err } from '../../types/Result';

export interface ThreadError {
  type: 'creation_failed' | 'fetch_failed' | 'send_failed';
  message: string;
  originalError?: Error;
}

const MAX_MESSAGE_LENGTH = 2000;
const CODE_BLOCK_REGEX = /```[\s\S]*?```/g;

export class ThreadManager {
  constructor(private logger: Logger) {}

  /**
   * Create new thread or get existing thread from message
   */
  async createOrGetThread(
    message: Message
  ): Promise<Result<ThreadChannel, ThreadError>> {
    try {
      // If already in a thread, return it
      if (message.channel.isThread()) {
        const thread = message.channel as ThreadChannel;
        this.logger.debug('Using existing thread', {
          threadId: thread.id,
          threadName: thread.name,
        });
        return ok(thread);
      }

      // Create new thread
      const thread = await message.startThread({
        name: `会話 - ${new Date().toLocaleString('ja-JP')}`,
        autoArchiveDuration: 60, // 1 hour
      });

      this.logger.info('Created new thread', {
        threadId: thread.id,
        threadName: thread.name,
        messageId: message.id,
      });

      return ok(thread);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to create thread', error as Error, {
        messageId: message.id,
      });

      const threadError: ThreadError = {
        type: 'creation_failed',
        message: `Thread creation failed: ${errorMessage}`,
      };
      if (error instanceof Error) {
        threadError.originalError = error;
      }
      return err(threadError);
    }
  }

  /**
   * Fetch message history from thread
   */
  async fetchThreadHistory(
    thread: ThreadChannel,
    limit: number = 100
  ): Promise<Result<Message[], ThreadError>> {
    try {
      const messages = await thread.messages.fetch({ limit });
      const messageArray = Array.from(messages.values());

      this.logger.debug('Fetched thread history', {
        threadId: thread.id,
        messageCount: messageArray.length,
      });

      return ok(messageArray);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to fetch thread history', error as Error, {
        threadId: thread.id,
      });

      const threadError: ThreadError = {
        type: 'fetch_failed',
        message: `Failed to fetch thread history: ${errorMessage}`,
      };
      if (error instanceof Error) {
        threadError.originalError = error;
      }
      return err(threadError);
    }
  }

  /**
   * Send message to thread with automatic splitting if needed
   */
  async sendToThread(
    thread: ThreadChannel,
    content: string
  ): Promise<Result<Message, ThreadError>> {
    try {
      const chunks = this.splitLongMessage(content);

      this.logger.debug('Sending message to thread', {
        threadId: thread.id,
        chunks: chunks.length,
        totalLength: content.length,
      });

      let lastMessage: Message | undefined;

      for (const chunk of chunks) {
        lastMessage = await thread.send(chunk);
      }

      if (!lastMessage) {
        throw new Error('No message was sent');
      }

      return ok(lastMessage);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to send message to thread', error as Error, {
        threadId: thread.id,
      });

      const threadError: ThreadError = {
        type: 'send_failed',
        message: `Failed to send message: ${errorMessage}`,
      };
      if (error instanceof Error) {
        threadError.originalError = error;
      }
      return err(threadError);
    }
  }

  /**
   * Send typing indicator to thread
   */
  async sendTypingIndicator(thread: ThreadChannel): Promise<void> {
    try {
      await thread.sendTyping();
      this.logger.debug('Sent typing indicator', {
        threadId: thread.id,
      });
    } catch (error) {
      // Typing indicator failure is not critical
      this.logger.warn('Failed to send typing indicator', {
        threadId: thread.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Split long message into chunks of max 2000 characters
   * Preserves code blocks and prefers splitting at newlines
   */
  splitLongMessage(content: string): string[] {
    if (content.length <= MAX_MESSAGE_LENGTH) {
      return [content];
    }

    const chunks: string[] = [];
    let remaining = content;

    while (remaining.length > 0) {
      if (remaining.length <= MAX_MESSAGE_LENGTH) {
        chunks.push(remaining);
        break;
      }

      // Try to find a good split point
      let splitPoint = MAX_MESSAGE_LENGTH;

      // Check if we're in a code block
      const codeBlockMatch = remaining.match(CODE_BLOCK_REGEX);
      if (codeBlockMatch && codeBlockMatch.index !== undefined) {
        const codeBlockStart = codeBlockMatch.index;
        const codeBlockEnd = codeBlockStart + codeBlockMatch[0].length;

        // If code block is within our limit, include it
        if (codeBlockEnd <= MAX_MESSAGE_LENGTH) {
          splitPoint = codeBlockEnd;
        } else if (codeBlockStart < MAX_MESSAGE_LENGTH) {
          // Code block starts before limit but extends beyond
          // Split before the code block or at a newline
          const newlineBeforeBlock = remaining.lastIndexOf(
            '\n',
            codeBlockStart
          );
          if (newlineBeforeBlock > 0) {
            splitPoint = newlineBeforeBlock + 1;
          } else {
            // Force split and close code block
            splitPoint = MAX_MESSAGE_LENGTH - 4; // Leave room for ```\n
            const chunk = remaining.substring(0, splitPoint) + '\n```';
            chunks.push(chunk);
            remaining = '```\n' + remaining.substring(splitPoint);
            continue;
          }
        }
      } else {
        // No code block, try to split at last newline
        const lastNewline = remaining.lastIndexOf('\n', MAX_MESSAGE_LENGTH);
        if (lastNewline > MAX_MESSAGE_LENGTH / 2) {
          // Only use newline if it's not too far back
          splitPoint = lastNewline + 1;
        }
      }

      const chunk = remaining.substring(0, splitPoint);
      chunks.push(chunk);
      remaining = remaining.substring(splitPoint);
    }

    return chunks;
  }
}
