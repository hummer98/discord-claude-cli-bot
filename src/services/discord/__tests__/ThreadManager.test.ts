/**
 * ThreadManager Tests
 * Test the thread management service using TDD methodology
 */

import { Message, ThreadChannel } from 'discord.js';
import { ThreadManager } from '../ThreadManager';
import { Logger } from '../../logger/Logger';

describe('ThreadManager', () => {
  let mockLogger: jest.Mocked<Logger>;
  let threadManager: ThreadManager;

  beforeEach(() => {
    // Mock Logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      maskSensitiveData: jest.fn((text) => text),
    } as unknown as jest.Mocked<Logger>;

    threadManager = new ThreadManager(mockLogger);
  });

  describe('createOrGetThread', () => {
    it('should create new thread for non-thread message', async () => {
      const mockThread = {
        id: 'thread-123',
        name: 'Test Thread',
      } as ThreadChannel;

      const mockMessage = {
        id: 'msg-123',
        content: 'Test message',
        channel: {
          isThread: jest.fn().mockReturnValue(false),
        },
        startThread: jest.fn().mockResolvedValue(mockThread),
      } as unknown as Message;

      const result = await threadManager.createOrGetThread(mockMessage);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(mockThread);
        expect(mockMessage.startThread).toHaveBeenCalledWith({
          name: expect.stringContaining('会話'),
          autoArchiveDuration: 60,
        });
      }
    });

    it('should return existing thread for thread message', async () => {
      const mockThread = {
        id: 'thread-456',
        name: 'Existing Thread',
        isThread: jest.fn().mockReturnValue(true),
      } as unknown as ThreadChannel;

      const mockMessage = {
        id: 'msg-456',
        content: 'Thread message',
        channel: mockThread,
      } as unknown as Message;

      const result = await threadManager.createOrGetThread(mockMessage);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(mockThread);
      }
    });

    it('should return error when thread creation fails', async () => {
      const mockMessage = {
        id: 'msg-error',
        channel: {
          isThread: jest.fn().mockReturnValue(false),
        },
        startThread: jest
          .fn()
          .mockRejectedValue(new Error('Thread creation failed')),
      } as unknown as Message;

      const result = await threadManager.createOrGetThread(mockMessage);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('creation_failed');
        expect(result.error.message).toContain('Thread creation failed');
      }
    });
  });

  describe('fetchThreadHistory', () => {
    it('should fetch thread messages with default limit', async () => {
      const mockMessages = [
        { id: 'msg-1', content: 'First' },
        { id: 'msg-2', content: 'Second' },
      ];

      const mockThread = {
        id: 'thread-789',
        messages: {
          fetch: jest.fn().mockResolvedValue(
            new Map([
              ['msg-1', mockMessages[0]],
              ['msg-2', mockMessages[1]],
            ])
          ),
        },
      } as unknown as ThreadChannel;

      const result = await threadManager.fetchThreadHistory(mockThread);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(mockThread.messages.fetch).toHaveBeenCalledWith({ limit: 100 });
      }
    });

    it('should fetch thread messages with custom limit', async () => {
      const mockThread = {
        id: 'thread-custom',
        messages: {
          fetch: jest.fn().mockResolvedValue(new Map()),
        },
      } as unknown as ThreadChannel;

      await threadManager.fetchThreadHistory(mockThread, 50);

      expect(mockThread.messages.fetch).toHaveBeenCalledWith({ limit: 50 });
    });

    it('should return error when fetch fails', async () => {
      const mockThread = {
        id: 'thread-fail',
        messages: {
          fetch: jest.fn().mockRejectedValue(new Error('Fetch failed')),
        },
      } as unknown as ThreadChannel;

      const result = await threadManager.fetchThreadHistory(mockThread);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('fetch_failed');
      }
    });
  });

  describe('sendToThread', () => {
    it('should send message to thread', async () => {
      const mockSentMessage = {
        id: 'sent-123',
        content: 'Response',
      } as Message;

      const mockThread = {
        id: 'thread-send',
        send: jest.fn().mockResolvedValue(mockSentMessage),
      } as unknown as ThreadChannel;

      const result = await threadManager.sendToThread(
        mockThread,
        'Test response'
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(mockSentMessage);
        expect(mockThread.send).toHaveBeenCalledWith('Test response');
      }
    });

    it('should split long message into chunks', async () => {
      const longContent = 'a'.repeat(2500); // Exceeds 2000 limit
      const mockThread = {
        id: 'thread-long',
        send: jest.fn().mockResolvedValue({} as Message),
      } as unknown as ThreadChannel;

      const result = await threadManager.sendToThread(mockThread, longContent);

      expect(result.ok).toBe(true);
      // Should be called multiple times for split messages
      expect(mockThread.send).toHaveBeenCalledTimes(2);
    });

    it('should return error when send fails', async () => {
      const mockThread = {
        id: 'thread-error',
        send: jest.fn().mockRejectedValue(new Error('Send failed')),
      } as unknown as ThreadChannel;

      const result = await threadManager.sendToThread(
        mockThread,
        'Test message'
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('send_failed');
      }
    });
  });

  describe('sendTypingIndicator', () => {
    it('should send typing indicator', async () => {
      const mockThread = {
        id: 'thread-typing',
        sendTyping: jest.fn().mockResolvedValue(undefined),
      } as unknown as ThreadChannel;

      await threadManager.sendTypingIndicator(mockThread);

      expect(mockThread.sendTyping).toHaveBeenCalled();
    });

    it('should handle typing indicator failure gracefully', async () => {
      const mockThread = {
        id: 'thread-typing-fail',
        sendTyping: jest.fn().mockRejectedValue(new Error('Typing failed')),
      } as unknown as ThreadChannel;

      // Should not throw
      await expect(
        threadManager.sendTypingIndicator(mockThread)
      ).resolves.not.toThrow();
    });
  });

  describe('splitLongMessage', () => {
    it('should not split short messages', () => {
      const shortMessage = 'Short message';
      const result = threadManager.splitLongMessage(shortMessage);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(shortMessage);
    });

    it('should split long messages at 2000 character limit', () => {
      const longMessage = 'a'.repeat(5000);
      const result = threadManager.splitLongMessage(longMessage);

      expect(result.length).toBeGreaterThan(1);
      result.forEach((chunk: string) => {
        expect(chunk.length).toBeLessThanOrEqual(2000);
      });
    });

    it('should preserve code blocks when splitting', () => {
      const messageWithCode =
        '```typescript\n' + 'x'.repeat(1950) + '\n```\nMore text';
      const result = threadManager.splitLongMessage(messageWithCode);

      // First chunk should preserve opening code block
      expect(result[0] ?? '').toContain('```typescript');
      // Should close code block if split
      if (result.length > 1) {
        expect(result[0] ?? '').toMatch(/```\s*$/);
      }
    });

    it('should split at newlines when possible', () => {
      const message = 'Line 1\n'.repeat(200) + 'a'.repeat(2000);
      const result = threadManager.splitLongMessage(message);

      // Should prefer splitting at newlines
      expect(result.length).toBeGreaterThan(1);
      result.forEach((chunk: string, index: number) => {
        if (index < result.length - 1) {
          // Not last chunk
          expect(chunk.length).toBeLessThanOrEqual(2000);
        }
      });
    });
  });
});
