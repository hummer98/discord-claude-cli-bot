/**
 * ConfigAdapter Test
 * Tests environment variable validation and configuration management
 */

import { ConfigAdapter, ConfigKey } from '../ConfigAdapter';

describe('ConfigAdapter', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validate', () => {
    it('should pass validation when all required env vars are set (with ANTHROPIC_AUTH_TOKEN)', () => {
      process.env['DISCORD_BOT_TOKEN'] = 'test-discord-token';
      process.env['ANTHROPIC_AUTH_TOKEN'] = 'session_test-token';
      process.env['GIT_REPOSITORY_URL'] = 'https://github.com/test/repo.git';

      const config = new ConfigAdapter();
      const result = config.validate();

      expect(result.ok).toBe(true);
    });

    it('should pass validation when all required env vars are set (with ANTHROPIC_API_KEY)', () => {
      process.env['DISCORD_BOT_TOKEN'] = 'test-discord-token';
      process.env['ANTHROPIC_API_KEY'] = 'sk-ant-api03-test-key';
      process.env['GIT_REPOSITORY_URL'] = 'https://github.com/test/repo.git';

      const config = new ConfigAdapter();
      const result = config.validate();

      expect(result.ok).toBe(true);
    });

    it('should fail validation when DISCORD_BOT_TOKEN is missing', () => {
      process.env['ANTHROPIC_API_KEY'] = 'test-anthropic-key';
      process.env['GIT_REPOSITORY_URL'] = 'https://github.com/test/repo.git';

      const config = new ConfigAdapter();
      const result = config.validate();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toHaveLength(1);
        expect(result.error[0]?.key).toBe(ConfigKey.DISCORD_BOT_TOKEN);
        expect(result.error[0]?.reason).toBe('missing');
      }
    });

    it('should pass validation even when both ANTHROPIC_AUTH_TOKEN and ANTHROPIC_API_KEY are missing', () => {
      process.env['DISCORD_BOT_TOKEN'] = 'test-discord-token';
      process.env['GIT_REPOSITORY_URL'] = 'https://github.com/test/repo.git';

      const config = new ConfigAdapter();
      const result = config.validate();

      // Claude authentication check is disabled to allow testing OAuth flow
      expect(result.ok).toBe(true);
    });

    it('should fail validation when GIT_REPOSITORY_URL is missing', () => {
      process.env['DISCORD_BOT_TOKEN'] = 'test-discord-token';
      process.env['ANTHROPIC_API_KEY'] = 'test-anthropic-key';

      const config = new ConfigAdapter();
      const result = config.validate();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toHaveLength(1);
        expect(result.error[0]?.key).toBe(ConfigKey.GIT_REPOSITORY_URL);
        expect(result.error[0]?.reason).toBe('missing');
      }
    });

    it('should report multiple missing required env vars', () => {
      const config = new ConfigAdapter();
      const result = config.validate();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        // DISCORD_BOT_TOKEN, GIT_REPOSITORY_URL
        // Note: Claude authentication check is disabled to allow testing OAuth flow
        expect(result.error.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('get', () => {
    it('should return the value of a required env var', () => {
      process.env['DISCORD_BOT_TOKEN'] = 'test-discord-token';
      process.env['ANTHROPIC_API_KEY'] = 'test-anthropic-key';
      process.env['GIT_REPOSITORY_URL'] = 'https://github.com/test/repo.git';

      const config = new ConfigAdapter();
      const token = config.get(ConfigKey.DISCORD_BOT_TOKEN);

      expect(token).toBe('test-discord-token');
    });

    it('should throw error when required env var is not set', () => {
      const config = new ConfigAdapter();

      expect(() => {
        config.get(ConfigKey.DISCORD_BOT_TOKEN);
      }).toThrow();
    });
  });

  describe('getOptional', () => {
    it('should return the value of an optional env var when set', () => {
      process.env['GITHUB_TOKEN'] = 'test-github-token';

      const config = new ConfigAdapter();
      const token = config.getOptional(ConfigKey.GITHUB_TOKEN, '');

      expect(token).toBe('test-github-token');
    });

    it('should return default value when optional env var is not set', () => {
      const config = new ConfigAdapter();
      const botName = config.getOptional(ConfigKey.BOT_NAME, 'DefaultBot');

      expect(botName).toBe('DefaultBot');
    });

    it('should return default LOG_LEVEL as info', () => {
      const config = new ConfigAdapter();
      const logLevel = config.getOptional(ConfigKey.LOG_LEVEL, 'info');

      expect(logLevel).toBe('info');
    });

    it('should return custom LOG_LEVEL when set', () => {
      process.env['LOG_LEVEL'] = 'debug';

      const config = new ConfigAdapter();
      const logLevel = config.getOptional(ConfigKey.LOG_LEVEL, 'info');

      expect(logLevel).toBe('debug');
    });

    it('should return default MAX_THREAD_HISTORY as 50', () => {
      const config = new ConfigAdapter();
      const maxHistory = config.getOptional(ConfigKey.MAX_THREAD_HISTORY, '50');

      expect(maxHistory).toBe('50');
    });

    it('should parse boolean LOG_TO_FILE correctly', () => {
      process.env['LOG_TO_FILE'] = 'true';

      const config = new ConfigAdapter();
      const logToFile = config.getOptional(ConfigKey.LOG_TO_FILE, 'false');

      expect(logToFile).toBe('true');
    });
  });

  describe('error message formatting', () => {
    it('should provide detailed error message for missing env vars', () => {
      const config = new ConfigAdapter();
      const result = config.validate();

      if (!result.ok) {
        const errors = result.error;
        expect(errors.length).toBeGreaterThan(0);

        const discordTokenError = errors.find(
          (e: { key: ConfigKey; reason: string }) => e.key === ConfigKey.DISCORD_BOT_TOKEN
        );
        expect(discordTokenError).toBeDefined();
        expect(discordTokenError?.reason).toBe('missing');
      }
    });
  });
});
