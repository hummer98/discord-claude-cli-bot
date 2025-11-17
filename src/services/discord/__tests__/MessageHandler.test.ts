/**
 * MessageHandler Tests
 * Test the message handling service using TDD methodology
 */

import { Message, User, ThreadChannel } from 'discord.js';
import { MessageHandler, Command } from '../MessageHandler';
import { DiscordClient } from '../DiscordClient';
import { Logger } from '../../logger/Logger';

describe('MessageHandler', () => {
  let mockDiscordClient: jest.Mocked<DiscordClient>;
  let mockLogger: jest.Mocked<Logger>;
  let messageHandler: MessageHandler;
  let mockBotUser: jest.Mocked<User>;

  beforeEach(() => {
    // Mock DiscordClient
    mockBotUser = {
      id: 'bot-123',
      username: 'TestBot',
    } as jest.Mocked<User>;

    mockDiscordClient = {
      getUser: jest.fn().mockReturnValue(mockBotUser),
      on: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      getUptime: jest.fn(),
      getClient: jest.fn(),
    } as unknown as jest.Mocked<DiscordClient>;

    // Mock Logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      maskSensitiveData: jest.fn((text) => text),
    } as unknown as jest.Mocked<Logger>;

    messageHandler = new MessageHandler(mockDiscordClient, mockLogger);
  });

  describe('isBotMention', () => {
    it('should detect when bot is mentioned', () => {
      const mockMessage = {
        mentions: {
          has: jest.fn().mockReturnValue(true),
        },
      } as unknown as Message;

      const result = messageHandler.isBotMention(mockMessage);

      expect(result).toBe(true);
      expect(mockMessage.mentions.has).toHaveBeenCalledWith('bot-123');
    });

    it('should return false when bot is not mentioned', () => {
      const mockMessage = {
        mentions: {
          has: jest.fn().mockReturnValue(false),
        },
      } as unknown as Message;

      const result = messageHandler.isBotMention(mockMessage);

      expect(result).toBe(false);
    });

    it('should handle bot user not available', () => {
      mockDiscordClient.getUser.mockReturnValue(null);
      const mockMessage = {
        mentions: {
          has: jest.fn(),
        },
      } as unknown as Message;

      const result = messageHandler.isBotMention(mockMessage);

      expect(result).toBe(false);
    });
  });

  describe('parseCommand', () => {
    it('should parse status command', () => {
      const mockMessage = {
        content: '@bot status',
        channel: { isThread: jest.fn().mockReturnValue(false) } as any,
        mentions: {
          has: jest.fn().mockReturnValue(true),
        },
      } as unknown as Message;

      const command = messageHandler.parseCommand(mockMessage);

      expect(command).toBeDefined();
      expect(command?.type).toBe('status');
      expect(command?.message).toBe(mockMessage);
    });

    it('should parse chat command from mention', () => {
      const mockMessage = {
        content: '@bot hello there',
        channel: { isThread: jest.fn().mockReturnValue(false) } as any,
        mentions: {
          has: jest.fn().mockReturnValue(true),
        },
      } as unknown as Message;

      const command = messageHandler.parseCommand(mockMessage);

      expect(command).toBeDefined();
      expect(command?.type).toBe('chat');
      expect(command?.content).toBe('@bot hello there');
      expect(command?.message).toBe(mockMessage);
    });

    it('should parse chat command from thread message', () => {
      const mockThread = {
        isThread: jest.fn().mockReturnValue(true),
      } as unknown as ThreadChannel;

      const mockMessage = {
        content: 'hello in thread',
        channel: mockThread,
        mentions: {
          has: jest.fn().mockReturnValue(false),
        },
      } as unknown as Message;

      const command = messageHandler.parseCommand(mockMessage);

      expect(command).toBeDefined();
      expect(command?.type).toBe('chat');
      expect(command?.content).toBe('hello in thread');
      expect(command?.thread).toBe(mockThread);
    });

    it('should return null for non-mention non-thread message', () => {
      const mockMessage = {
        content: 'just a regular message',
        channel: { isThread: jest.fn().mockReturnValue(false) } as any,
        mentions: {
          has: jest.fn().mockReturnValue(false),
        },
      } as unknown as Message;

      const command = messageHandler.parseCommand(mockMessage);

      expect(command).toBeNull();
    });
  });

  describe('handleMessage', () => {
    it('should ignore messages from bots', async () => {
      const mockMessage = {
        author: {
          bot: true,
          id: 'other-bot',
        },
        content: '@bot hello',
      } as unknown as Message;

      await messageHandler.handleMessage(mockMessage);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Ignoring bot message',
        expect.any(Object)
      );
    });

    it('should ignore messages from self', async () => {
      const mockMessage = {
        author: {
          bot: true,
          id: 'bot-123',
        },
        content: 'response',
      } as unknown as Message;

      await messageHandler.handleMessage(mockMessage);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Ignoring bot message',
        expect.any(Object)
      );
    });

    it('should process valid mention message', async () => {
      const mockMessage = {
        id: 'msg-123',
        author: {
          bot: false,
          id: 'user-123',
          username: 'TestUser',
        },
        content: '@bot hello',
        channel: {
          id: 'channel-123',
          isThread: jest.fn().mockReturnValue(false),
        },
        mentions: {
          has: jest.fn().mockReturnValue(true),
        },
      } as unknown as Message;

      const commandHandler = jest.fn().mockResolvedValue(undefined);
      messageHandler.setCommandHandler(commandHandler);

      await messageHandler.handleMessage(mockMessage);

      expect(commandHandler).toHaveBeenCalled();
      const command: Command = commandHandler.mock.calls[0]?.[0];
      expect(command.type).toBe('chat');
      expect(command.message).toBe(mockMessage);
    });

    it('should process thread message without mention', async () => {
      const mockThread = {
        id: 'thread-123',
        isThread: jest.fn().mockReturnValue(true),
      } as unknown as ThreadChannel;

      const mockMessage = {
        id: 'msg-456',
        author: {
          bot: false,
          id: 'user-456',
          username: 'ThreadUser',
        },
        content: 'message in thread',
        channel: mockThread,
        mentions: {
          has: jest.fn().mockReturnValue(false),
        },
      } as unknown as Message;

      const commandHandler = jest.fn().mockResolvedValue(undefined);
      messageHandler.setCommandHandler(commandHandler);

      await messageHandler.handleMessage(mockMessage);

      expect(commandHandler).toHaveBeenCalled();
      const command: Command = commandHandler.mock.calls[0]?.[0];
      expect(command.type).toBe('chat');
      expect(command.thread).toBe(mockThread);
    });

    it('should handle command handler errors', async () => {
      const mockMessage = {
        id: 'msg-error',
        author: {
          bot: false,
          id: 'user-error',
        },
        content: '@bot test',
        channel: {
          isThread: jest.fn().mockReturnValue(false),
        },
        mentions: {
          has: jest.fn().mockReturnValue(true),
        },
      } as unknown as Message;

      const commandHandler = jest
        .fn()
        .mockRejectedValue(new Error('Handler failed'));
      messageHandler.setCommandHandler(commandHandler);

      await messageHandler.handleMessage(mockMessage);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error handling message',
        expect.any(Error),
        expect.objectContaining({ messageId: 'msg-error' })
      );
    });
  });

  describe('setCommandHandler', () => {
    it('should set command handler callback', () => {
      const handler = jest.fn();
      messageHandler.setCommandHandler(handler);

      // This is tested indirectly through handleMessage tests above
      expect(handler).toBeDefined();
    });
  });
});
