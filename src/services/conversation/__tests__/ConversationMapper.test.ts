/**
 * ConversationMapper Tests
 * Test-Driven Development: Write tests before implementation
 */

import { ConversationMapper } from '../ConversationMapper';
import { Message, User, Client } from 'discord.js';

describe('ConversationMapper', () => {
  let mapper: ConversationMapper;
  let mockBotClient: jest.Mocked<Client>;

  beforeEach(() => {
    // Mock bot client
    mockBotClient = {
      user: {
        id: 'bot-123',
        username: 'TestBot',
      },
    } as unknown as jest.Mocked<Client>;

    mapper = new ConversationMapper(mockBotClient);
  });

  describe('toClaudeMessages', () => {
    const createMockMessage = (
      authorId: string,
      authorName: string,
      content: string,
      timestamp: number
    ): Message => ({
      id: `msg-${timestamp}`,
      content,
      author: {
        id: authorId,
        username: authorName,
        bot: authorId === 'bot-123',
      } as User,
      createdTimestamp: timestamp,
      mentions: {
        has: jest.fn().mockReturnValue(content.includes('@TestBot')),
      } as any,
    } as Message);

    it('should convert user messages to Claude format', () => {
      const messages = [
        createMockMessage('user-1', 'Alice', 'Hello', 1000),
      ] as Message[];

      const result = mapper.toClaudeMessages(messages);

      expect(result).toEqual([
        {
          role: 'user',
          content: 'Hello',
        },
      ]);
    });

    it('should convert bot messages to assistant role', () => {
      const messages = [
        createMockMessage('user-1', 'Alice', 'Hello', 1000),
        createMockMessage('bot-123', 'TestBot', 'Hi there!', 2000),
        createMockMessage('user-1', 'Alice', 'Thanks', 3000),
      ] as Message[];

      const result = mapper.toClaudeMessages(messages);

      expect(result).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'Thanks' },
      ]);
    });

    it('should sort messages by timestamp in ascending order', () => {
      const messages = [
        createMockMessage('user-1', 'Alice', 'Third message', 3000),
        createMockMessage('user-1', 'Alice', 'First message', 1000),
        createMockMessage('bot-123', 'TestBot', 'Second response', 2000),
      ] as Message[];

      const result = mapper.toClaudeMessages(messages);

      expect(result).toEqual([
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'Second response' },
        { role: 'user', content: 'Third message' },
      ]);
    });

    it('should remove bot mentions from messages', () => {
      const messages = [
        createMockMessage('user-1', 'Alice', '@TestBot hello there', 1000),
      ] as Message[];

      const result = mapper.toClaudeMessages(messages);

      expect(result).toEqual([
        { role: 'user', content: 'hello there' },
      ]);
    });

    it('should limit history to maxHistory messages', () => {
      const messages = Array.from({ length: 100 }, (_, i) =>
        createMockMessage('user-1', 'Alice', `Message ${i}`, i * 1000)
      ) as Message[];

      const result = mapper.toClaudeMessages(messages, 50);

      // All consecutive user messages get merged, so we get 1 message
      expect(result).toHaveLength(1);
      // Should contain the last 50 messages merged
      expect(result[0]?.content).toContain('Message 50');
      expect(result[0]?.content).toContain('Message 99');
    });

    it('should ensure last message is user role', () => {
      const messages = [
        createMockMessage('user-1', 'Alice', 'User message', 1000),
        createMockMessage('bot-123', 'TestBot', 'Bot response', 2000),
      ] as Message[];

      const result = mapper.toClaudeMessages(messages);

      // Bot message at the end should be removed to ensure user is last
      expect(result).toHaveLength(1);
      expect(result[result.length - 1]?.role).toBe('user');
    });

    it('should merge consecutive user messages', () => {
      const messages = [
        createMockMessage('user-1', 'Alice', 'First part', 1000),
        createMockMessage('user-1', 'Alice', 'Second part', 1500),
        createMockMessage('bot-123', 'TestBot', 'Bot response', 2000),
        createMockMessage('user-2', 'Bob', 'Third message', 3000),
      ] as Message[];

      const result = mapper.toClaudeMessages(messages);

      expect(result).toEqual([
        { role: 'user', content: 'First part\nSecond part' },
        { role: 'assistant', content: 'Bot response' },
        { role: 'user', content: 'Third message' },
      ]);
    });

    it('should merge consecutive assistant messages', () => {
      const messages = [
        createMockMessage('user-1', 'Alice', 'User message', 1000),
        createMockMessage('bot-123', 'TestBot', 'First response', 2000),
        createMockMessage('bot-123', 'TestBot', 'Second response', 2500),
        createMockMessage('user-1', 'Alice', 'Next question', 3000),
      ] as Message[];

      const result = mapper.toClaudeMessages(messages);

      expect(result).toEqual([
        { role: 'user', content: 'User message' },
        { role: 'assistant', content: 'First response\nSecond response' },
        { role: 'user', content: 'Next question' },
      ]);
    });

    it('should handle empty content gracefully', () => {
      const messages = [
        createMockMessage('user-1', 'Alice', '', 1000),
        createMockMessage('user-1', 'Alice', 'Valid message', 2000),
      ] as Message[];

      const result = mapper.toClaudeMessages(messages);

      expect(result).toEqual([
        { role: 'user', content: 'Valid message' },
      ]);
    });

    it('should trim whitespace from messages', () => {
      const messages = [
        createMockMessage('user-1', 'Alice', '  Hello world  ', 1000),
      ] as Message[];

      const result = mapper.toClaudeMessages(messages);

      expect(result).toEqual([
        { role: 'user', content: 'Hello world' },
      ]);
    });

    it('should handle only bot messages by returning empty array', () => {
      const messages = [
        createMockMessage('bot-123', 'TestBot', 'Bot message', 1000),
        createMockMessage('bot-123', 'TestBot', 'Another bot message', 2000),
      ] as Message[];

      const result = mapper.toClaudeMessages(messages);

      // No user messages, so should return empty
      expect(result).toEqual([]);
    });
  });
});
