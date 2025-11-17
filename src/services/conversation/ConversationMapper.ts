/**
 * ConversationMapper
 * Converts Discord messages to Claude API format
 */

import { Message, Client } from 'discord.js';
import { ClaudeMessage } from '../../adapters/claude/ClaudeAdapter';

const DEFAULT_MAX_HISTORY = 50;

export class ConversationMapper {
  private botClient: Client;

  constructor(botClient: Client) {
    this.botClient = botClient;
  }

  /**
   * Convert Discord messages to Claude message format
   * - Sorts by timestamp (ascending)
   * - Assigns user/assistant roles
   * - Removes bot mentions
   * - Merges consecutive messages from same role
   * - Limits to maxHistory messages
   * - Ensures last message is user role
   */
  toClaudeMessages(
    messages: Message[],
    maxHistory: number = DEFAULT_MAX_HISTORY
  ): ClaudeMessage[] {
    if (!this.botClient.user) {
      return [];
    }

    const botId = this.botClient.user.id;

    // Sort by timestamp (ascending - oldest first)
    const sortedMessages = [...messages].sort(
      (a, b) => a.createdTimestamp - b.createdTimestamp
    );

    // Apply max history limit (keep most recent)
    const limitedMessages =
      sortedMessages.length > maxHistory
        ? sortedMessages.slice(-maxHistory)
        : sortedMessages;

    // Convert to Claude format
    const claudeMessages: ClaudeMessage[] = [];

    for (const message of limitedMessages) {
      // Skip empty messages
      const cleanedContent = this.cleanMessage(message.content, botId);
      if (!cleanedContent) {
        continue;
      }

      const role: 'user' | 'assistant' = message.author.bot ? 'assistant' : 'user';

      // Merge consecutive messages from same role
      const lastMessage = claudeMessages[claudeMessages.length - 1];
      if (claudeMessages.length > 0 && lastMessage && lastMessage.role === role) {
        lastMessage.content += '\n' + cleanedContent;
      } else {
        claudeMessages.push({
          role,
          content: cleanedContent,
        });
      }
    }

    // Ensure last message is user role (Claude API requirement)
    while (claudeMessages.length > 0) {
      const lastMessage = claudeMessages[claudeMessages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        claudeMessages.pop();
      } else {
        break;
      }
    }

    return claudeMessages;
  }

  /**
   * Clean message content
   * - Remove bot mentions
   * - Trim whitespace
   */
  private cleanMessage(content: string, botId: string): string {
    let cleaned = content;

    // Remove bot mention patterns
    // Matches <@botId>, <@!botId>, @BotName
    cleaned = cleaned.replace(new RegExp(`<@!?${botId}>`, 'g'), '');
    cleaned = cleaned.replace(/@\w+/g, (match) => {
      // Keep mentions that are not the bot
      if (this.botClient.user && match.includes(this.botClient.user.username)) {
        return '';
      }
      return match;
    });

    // Trim whitespace
    cleaned = cleaned.trim();

    return cleaned;
  }
}
