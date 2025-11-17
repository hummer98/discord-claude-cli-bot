/**
 * Logger Service Test
 * Tests structured logging and sensitive data masking
 */

import { Logger } from '../Logger';
import { ConfigAdapter } from '../../../adapters/config/ConfigAdapter';

describe('Logger', () => {
  let logger: Logger;
  let config: ConfigAdapter;

  beforeEach(() => {
    // Set up minimal config
    process.env['DISCORD_BOT_TOKEN'] = 'test-token';
    process.env['ANTHROPIC_API_KEY'] = 'test-key';
    process.env['GIT_REPOSITORY_URL'] = 'https://github.com/test/repo.git';
    process.env['LOG_LEVEL'] = 'debug';
    process.env['LOG_TO_FILE'] = 'false'; // Disable file logging in tests

    config = new ConfigAdapter();
    logger = new Logger(config);
  });

  describe('log levels', () => {
    it('should log debug messages without throwing', () => {
      expect(() => logger.debug('Debug message')).not.toThrow();
    });

    it('should log info messages without throwing', () => {
      expect(() => logger.info('Info message')).not.toThrow();
    });

    it('should log warn messages without throwing', () => {
      expect(() => logger.warn('Warning message')).not.toThrow();
    });

    it('should log error messages without throwing', () => {
      const error = new Error('Test error');
      expect(() => logger.error('Error occurred', error)).not.toThrow();
    });
  });

  describe('context logging', () => {
    it('should accept context in log output without throwing', () => {
      expect(() =>
        logger.info('Message with context', {
          messageId: '123',
          userId: '456',
        })
      ).not.toThrow();
    });

    it('should accept error stack traces without throwing', () => {
      const error = new Error('Test error');
      expect(() =>
        logger.error('Error with stack', error, { operation: 'test' })
      ).not.toThrow();
    });
  });

  describe('sensitive data masking', () => {
    it('should mask Anthropic API keys (sk-ant-...)', () => {
      const text = 'API Key: sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyz123456';
      const masked = logger.maskSensitiveData(text);

      expect(masked).not.toContain('sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyz123456');
      expect(masked).toContain('sk-ant-***');
    });

    it('should mask ANTHROPIC_API_KEY env var format', () => {
      const text = 'ANTHROPIC_API_KEY=sk-ant-api03-secret123';
      const masked = logger.maskSensitiveData(text);

      expect(masked).toContain('ANTHROPIC_API_KEY=***');
      expect(masked).not.toContain('secret123');
    });

    it('should mask Discord bot tokens', () => {
      const text = 'Token: EXAMPLE_DISCORD_TOKEN_XXXXXXXXXXXXXXXX.XXXXXX.XXXXXXXXXXXXXXXXXXXXXXXX';
      const masked = logger.maskSensitiveData(text);

      expect(masked).toContain('DISCORD_TOKEN=***');
      expect(masked).not.toContain('EXAMPLE_DISCORD_TOKEN');
    });

    it('should mask GitHub tokens (ghp_...)', () => {
      const text = 'GitHub token: ghp_1234567890abcdefghijklmnopqrstuvwxyz';
      const masked = logger.maskSensitiveData(text);

      expect(masked).toContain('ghp_***');
      expect(masked).not.toContain('1234567890abcdefghijklmnopqrstuvwxyz');
    });

    it('should mask GitHub tokens in URLs', () => {
      const text = 'https://user:ghp_secret123@github.com/repo.git';
      const masked = logger.maskSensitiveData(text);

      expect(masked).toContain('https://github.com/***:***@');
      expect(masked).not.toContain('ghp_secret123');
    });

    it('should mask Bearer tokens', () => {
      const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const masked = logger.maskSensitiveData(text);

      expect(masked).toContain('Bearer ***');
      expect(masked).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('should mask multiple sensitive values in one string', () => {
      const text =
        'API: sk-ant-secret1234567890, Token: ghp_token4567890123, Auth: Bearer xyz789token123';
      const masked = logger.maskSensitiveData(text);

      expect(masked).not.toContain('secret1234567890');
      expect(masked).not.toContain('token4567890123');
      expect(masked).not.toContain('xyz789token123');
      expect(masked).toContain('sk-ant-***');
      expect(masked).toContain('ghp_***');
      expect(masked).toContain('Bearer ***');
    });

    it('should handle empty strings', () => {
      const masked = logger.maskSensitiveData('');
      expect(masked).toBe('');
    });

    it('should handle strings without sensitive data', () => {
      const text = 'This is a normal log message';
      const masked = logger.maskSensitiveData(text);
      expect(masked).toBe(text);
    });
  });

  describe('log level filtering', () => {
    it('should create logger with info level', () => {
      process.env['LOG_LEVEL'] = 'info';
      const infoLogger = new Logger(new ConfigAdapter());

      expect(() => infoLogger.debug('Should not appear')).not.toThrow();
    });

    it('should create logger with debug level', () => {
      process.env['LOG_LEVEL'] = 'debug';
      const debugLogger = new Logger(new ConfigAdapter());

      expect(() => debugLogger.debug('Should appear')).not.toThrow();
    });
  });
});
