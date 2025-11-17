/**
 * ConversationService
 * Manages Discord conversation to Claude API processing
 */

import { Message } from 'discord.js';
import { ConversationMapper } from './ConversationMapper';
import { ClaudeCliAdapter, ClaudeError } from '../../adapters/claude/ClaudeCliAdapter';
import { Logger } from '../logger/Logger';
import { Result, ok, err } from '../../types/Result';

const DEFAULT_MAX_HISTORY = 50;

export class ConversationService {
  private mapper: ConversationMapper;
  private claudeAdapter: ClaudeCliAdapter;
  private logger: Logger;

  constructor(
    mapper: ConversationMapper,
    claudeAdapter: ClaudeCliAdapter,
    logger: Logger
  ) {
    this.mapper = mapper;
    this.claudeAdapter = claudeAdapter;
    this.logger = logger;
  }

  /**
   * Process conversation by converting Discord messages to Claude format
   * and sending to Claude API
   */
  async processConversation(
    messages: Message[],
    newMessage: string,
    maxHistory: number = DEFAULT_MAX_HISTORY
  ): Promise<Result<string, ClaudeError>> {
    this.logger.info('Processing conversation', {
      historyCount: messages.length,
      newMessage: newMessage.substring(0, 100),
    });

    try {
      // Create a synthetic message object for the new message
      const syntheticMessage = {
        content: newMessage,
        createdTimestamp: Date.now(),
        author: {
          bot: false,
        },
      } as Message;

      // Combine history with new message
      const allMessages = [...messages, syntheticMessage];

      // Convert to Claude format
      const claudeMessages = this.mapper.toClaudeMessages(
        allMessages,
        maxHistory
      );

      // Send to Claude API
      const result = await this.claudeAdapter.sendMessage(claudeMessages);

      if (!result.ok) {
        this.logger.error('Failed to process conversation', new Error(result.error.message), {
          errorType: result.error.type,
        });
        return err(result.error);
      }

      this.logger.info('Conversation processed successfully', {
        responseLength: result.value.content.length,
        inputTokens: result.value.usage?.inputTokens,
        outputTokens: result.value.usage?.outputTokens,
      });

      return ok(result.value.content);
    } catch (error) {
      this.logger.error(
        'Unexpected error processing conversation',
        error as Error
      );
      return err({
        type: 'unknown' as const,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
