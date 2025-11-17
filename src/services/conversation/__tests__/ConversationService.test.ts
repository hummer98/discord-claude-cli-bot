/**
 * ConversationService Tests
 * Test-Driven Development: Write tests before implementation
 */

import { ConversationService } from '../ConversationService';
import { ConversationMapper } from '../ConversationMapper';
import { ClaudeCliAdapter } from '../../../adapters/claude/ClaudeCliAdapter';
import { Logger } from '../../logger/Logger';
import { Message, Client } from 'discord.js';

jest.mock('../ConversationMapper');
jest.mock('../../../adapters/claude/ClaudeCliAdapter');
jest.mock('../../logger/Logger');

describe('ConversationService', () => {
  let service: ConversationService;
  let mockMapper: jest.Mocked<ConversationMapper>;
  let mockClaudeAdapter: jest.Mocked<ClaudeCliAdapter>;
  let mockLogger: jest.Mocked<Logger>;
  let mockBotClient: jest.Mocked<Client>;

  beforeEach(() => {
    mockBotClient = {
      user: { id: 'bot-123' },
    } as unknown as jest.Mocked<Client>;

    mockMapper = new ConversationMapper(
      mockBotClient
    ) as jest.Mocked<ConversationMapper>;
    mockClaudeAdapter = {} as jest.Mocked<ClaudeCliAdapter>;
    mockLogger = {} as jest.Mocked<Logger>;
    mockLogger.info = jest.fn();
    mockLogger.error = jest.fn();

    service = new ConversationService(
      mockMapper,
      mockClaudeAdapter,
      mockLogger
    );
  });

  describe('processConversation', () => {
    const createMockMessage = (
      content: string,
      timestamp: number
    ): Message => ({
      id: `msg-${timestamp}`,
      content,
      createdTimestamp: timestamp,
    } as Message);

    it('should process conversation and return Claude response', async () => {
      const messages = [
        createMockMessage('Hello', 1000),
        createMockMessage('How are you?', 2000),
      ] as Message[];

      const newMessage = 'What can you help me with?';

      mockMapper.toClaudeMessages.mockReturnValue([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
        { role: 'assistant', content: 'I am doing well!' },
        { role: 'user', content: newMessage },
      ]);

      mockClaudeAdapter.sendMessage = jest.fn().mockResolvedValue({
        ok: true,
        value: {
          content: 'I can help you with many things!',
          usage: {
            inputTokens: 50,
            outputTokens: 20,
          },
        },
      });

      const result = await service.processConversation(messages, newMessage);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('I can help you with many things!');
      }

      expect(mockMapper.toClaudeMessages).toHaveBeenCalledWith(
        expect.any(Array),
        50
      );
      expect(mockClaudeAdapter.sendMessage).toHaveBeenCalledWith([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
        { role: 'assistant', content: 'I am doing well!' },
        { role: 'user', content: newMessage },
      ]);
    });

    it('should add new message to history before sending', async () => {
      const messages = [createMockMessage('Previous message', 1000)] as Message[];
      const newMessage = 'New question';

      mockMapper.toClaudeMessages.mockReturnValue([
        { role: 'user', content: 'Previous message' },
        { role: 'user', content: newMessage },
      ]);

      mockClaudeAdapter.sendMessage = jest.fn().mockResolvedValue({
        ok: true,
        value: {
          content: 'Answer',
          usage: undefined,
        },
      });

      await service.processConversation(messages, newMessage);

      const capturedMessages = mockMapper.toClaudeMessages.mock.calls[0]?.[0];
      expect(capturedMessages).toHaveLength(2);
      expect(capturedMessages?.[1]?.content).toBe(newMessage);
    });

    it('should handle Claude API error', async () => {
      const messages = [createMockMessage('Hello', 1000)] as Message[];
      const newMessage = 'Test';

      mockMapper.toClaudeMessages.mockReturnValue([
        { role: 'user', content: 'Hello' },
        { role: 'user', content: newMessage },
      ]);

      mockClaudeAdapter.sendMessage = jest.fn().mockResolvedValue({
        ok: false,
        error: {
          type: 'rate_limit',
          message: 'レート制限に達しました',
          status: 429,
        },
      });

      const result = await service.processConversation(messages, newMessage);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('レート制限');
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to process conversation',
        expect.any(Error),
        expect.objectContaining({
          errorType: 'rate_limit',
        })
      );
    });

    it('should log conversation processing', async () => {
      const messages = [createMockMessage('Test', 1000)] as Message[];
      const newMessage = 'Question';

      mockMapper.toClaudeMessages.mockReturnValue([
        { role: 'user', content: 'Test' },
        { role: 'user', content: newMessage },
      ]);

      mockClaudeAdapter.sendMessage = jest.fn().mockResolvedValue({
        ok: true,
        value: {
          content: 'Answer',
          usage: {
            inputTokens: 10,
            outputTokens: 5,
          },
        },
      });

      await service.processConversation(messages, newMessage);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processing conversation',
        expect.objectContaining({
          historyCount: 1,
          newMessage: expect.stringContaining('Question'),
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Conversation processed successfully',
        expect.objectContaining({
          responseLength: expect.any(Number),
          inputTokens: 10,
          outputTokens: 5,
        })
      );
    });

    it('should use custom max history limit', async () => {
      const messages = Array.from({ length: 100 }, (_, i) =>
        createMockMessage(`Message ${i}`, i * 1000)
      ) as Message[];

      const newMessage = 'New message';
      const customMaxHistory = 20;

      mockMapper.toClaudeMessages.mockReturnValue([
        { role: 'user', content: 'Recent message' },
        { role: 'user', content: newMessage },
      ]);

      mockClaudeAdapter.sendMessage = jest.fn().mockResolvedValue({
        ok: true,
        value: { content: 'Response', usage: undefined },
      });

      await service.processConversation(messages, newMessage, customMaxHistory);

      expect(mockMapper.toClaudeMessages).toHaveBeenCalledWith(
        expect.any(Array),
        customMaxHistory
      );
    });

    it('should handle empty message history', async () => {
      const messages: Message[] = [];
      const newMessage = 'First message';

      mockMapper.toClaudeMessages.mockReturnValue([
        { role: 'user', content: newMessage },
      ]);

      mockClaudeAdapter.sendMessage = jest.fn().mockResolvedValue({
        ok: true,
        value: { content: 'Response', usage: undefined },
      });

      const result = await service.processConversation(messages, newMessage);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('Response');
      }
    });
  });
});
