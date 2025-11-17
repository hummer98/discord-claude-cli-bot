/**
 * DiscordClient Tests
 * Test the Discord client service using TDD methodology
 */

import { Client } from 'discord.js';
import { DiscordClient } from '../DiscordClient';
import { ConfigAdapter, ConfigKey } from '../../../adapters/config/ConfigAdapter';
import { Logger } from '../../logger/Logger';

// Mock discord.js
jest.mock('discord.js', () => ({
  Client: jest.fn(),
  GatewayIntentBits: {
    Guilds: 1 << 0,
    GuildMessages: 1 << 9,
    MessageContent: 1 << 15,
  },
}));

describe('DiscordClient', () => {
  let mockConfig: jest.Mocked<ConfigAdapter>;
  let mockLogger: jest.Mocked<Logger>;
  let mockClient: jest.Mocked<Client>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock ConfigAdapter
    mockConfig = {
      get: jest.fn(),
      getOptional: jest.fn(),
      validate: jest.fn(),
      formatValidationErrors: jest.fn(),
    } as unknown as jest.Mocked<ConfigAdapter>;

    mockConfig.get.mockImplementation((key: ConfigKey) => {
      if (key === ConfigKey.DISCORD_BOT_TOKEN) {
        return 'test-bot-token';
      }
      throw new Error(`Unexpected config key: ${key}`);
    });

    // Mock Logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      maskSensitiveData: jest.fn((text) => text),
    } as unknown as jest.Mocked<Logger>;

    // Mock Discord Client
    mockClient = {
      login: jest.fn().mockResolvedValue('token'),
      destroy: jest.fn(),
      on: jest.fn(),
      user: null,
    } as unknown as jest.Mocked<Client>;

    (Client as jest.MockedClass<typeof Client>).mockImplementation(
      () => mockClient
    );
  });

  describe('connect', () => {
    it('should connect to Discord Gateway with valid token', async () => {
      const discordClient = new DiscordClient(mockConfig, mockLogger);

      await discordClient.connect();

      expect(mockClient.login).toHaveBeenCalledWith('test-bot-token');
      expect(mockLogger.info).toHaveBeenCalledWith('Connecting to Discord...');
    });

    it('should set up clientReady event handler', async () => {
      const discordClient = new DiscordClient(mockConfig, mockLogger);

      await discordClient.connect();

      // Check that clientReady event was registered
      expect(mockClient.on).toHaveBeenCalledWith(
        'clientReady',
        expect.any(Function)
      );
    });

    it('should set up error event handler', async () => {
      const discordClient = new DiscordClient(mockConfig, mockLogger);

      await discordClient.connect();

      // Check that error event was registered
      expect(mockClient.on).toHaveBeenCalledWith(
        'error',
        expect.any(Function)
      );
    });

    it('should throw error if login fails', async () => {
      mockClient.login.mockRejectedValueOnce(new Error('Invalid token'));

      const discordClient = new DiscordClient(mockConfig, mockLogger);

      await expect(discordClient.connect()).rejects.toThrow('Invalid token');
    });

    it('should record start time on connection', async () => {
      const discordClient = new DiscordClient(mockConfig, mockLogger);

      await discordClient.connect();

      const uptime = discordClient.getUptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
      expect(uptime).toBeLessThan(1000); // Should be less than 1 second
    });
  });

  describe('disconnect', () => {
    it('should gracefully disconnect from Discord', async () => {
      const discordClient = new DiscordClient(mockConfig, mockLogger);
      await discordClient.connect();

      discordClient.disconnect();

      expect(mockClient.destroy).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Disconnected from Discord'
      );
    });

    it('should handle disconnect when not connected', () => {
      const discordClient = new DiscordClient(mockConfig, mockLogger);

      expect(() => discordClient.disconnect()).not.toThrow();
    });
  });

  describe('on', () => {
    it('should register messageCreate event handler', async () => {
      const discordClient = new DiscordClient(mockConfig, mockLogger);
      await discordClient.connect();

      const handler = jest.fn();
      discordClient.on('messageCreate', handler);

      expect(mockClient.on).toHaveBeenCalledWith('messageCreate', handler);
    });

    it('should register error event handler', async () => {
      const discordClient = new DiscordClient(mockConfig, mockLogger);
      await discordClient.connect();

      const handler = jest.fn();
      discordClient.on('error', handler);

      expect(mockClient.on).toHaveBeenCalledWith('error', handler);
    });

    it('should register clientReady event handler', async () => {
      const discordClient = new DiscordClient(mockConfig, mockLogger);
      await discordClient.connect();

      const handler = jest.fn();
      discordClient.on('clientReady', handler);

      expect(mockClient.on).toHaveBeenCalledWith('clientReady', handler);
    });
  });

  describe('getUser', () => {
    it('should return null when not connected', () => {
      const discordClient = new DiscordClient(mockConfig, mockLogger);

      expect(discordClient.getUser()).toBeNull();
    });

    it('should return user after connection', async () => {
      const mockUser = { id: '123', username: 'TestBot' };
      mockClient.user = mockUser as any;

      const discordClient = new DiscordClient(mockConfig, mockLogger);
      await discordClient.connect();

      expect(discordClient.getUser()).toBe(mockUser);
    });
  });

  describe('getUptime', () => {
    it('should return 0 before connection', () => {
      const discordClient = new DiscordClient(mockConfig, mockLogger);

      expect(discordClient.getUptime()).toBe(0);
    });

    it('should return elapsed time after connection', async () => {
      const discordClient = new DiscordClient(mockConfig, mockLogger);
      await discordClient.connect();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const uptime = discordClient.getUptime();
      expect(uptime).toBeGreaterThanOrEqual(100);
      expect(uptime).toBeLessThan(200);
    });
  });

  describe('getClient', () => {
    it('should return the underlying Discord client', () => {
      const discordClient = new DiscordClient(mockConfig, mockLogger);

      expect(discordClient.getClient()).toBe(mockClient);
    });
  });
});
