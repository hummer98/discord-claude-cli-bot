/**
 * ClaudeAdapter Tests
 * Test-Driven Development: Write tests before implementation
 */

import { ClaudeAdapter } from '../ClaudeAdapter';
import { ConfigAdapter } from '../../config/ConfigAdapter';
import { Logger } from '../../../services/logger/Logger';
import Anthropic from '@anthropic-ai/sdk';

// Mock dependencies
jest.mock('../../config/ConfigAdapter');
jest.mock('../../../services/logger/Logger');
jest.mock('@anthropic-ai/sdk');

describe('ClaudeAdapter', () => {
  let adapter: ClaudeAdapter;
  let mockConfig: jest.Mocked<ConfigAdapter>;
  let mockLogger: jest.Mocked<Logger>;
  let mockAnthropic: jest.Mocked<Anthropic>;

  beforeEach(() => {
    mockConfig = new ConfigAdapter() as jest.Mocked<ConfigAdapter>;
    mockConfig.get.mockReturnValue('sk-ant-test-key');

    mockLogger = new Logger(mockConfig) as jest.Mocked<Logger>;
    mockLogger.info = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.warn = jest.fn();

    mockAnthropic = new Anthropic({ apiKey: 'test' }) as jest.Mocked<Anthropic>;

    adapter = new ClaudeAdapter(mockConfig, mockLogger);
    (adapter as any).client = mockAnthropic;
  });

  describe('Initialization', () => {
    it('should initialize with API key from ConfigAdapter', () => {
      new ClaudeAdapter(mockConfig, mockLogger);
      expect(mockConfig.get).toHaveBeenCalledWith('ANTHROPIC_API_KEY');
    });

    it('should log initialization', () => {
      new ClaudeAdapter(mockConfig, mockLogger);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ClaudeAdapter initialized',
        expect.objectContaining({
          model: expect.any(String),
        })
      );
    });
  });

  describe('sendMessage', () => {
    const sampleMessages = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi there!' },
      { role: 'user' as const, content: 'How are you?' },
    ];

    it('should send messages successfully and return response', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message' as const,
        role: 'assistant' as const,
        content: [
          {
            type: 'text' as const,
            text: 'I am doing well, thank you!',
          },
        ],
        model: 'claude-sonnet-4-5-20250929',
        stop_reason: 'end_turn' as const,
        stop_sequence: null,
        usage: {
          input_tokens: 20,
          output_tokens: 15,
        },
      };

      mockAnthropic.messages = {
        create: jest.fn().mockResolvedValue(mockResponse),
      } as any;

      const result = await adapter.sendMessage(sampleMessages);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.content).toBe('I am doing well, thank you!');
        expect(result.value.usage).toEqual({
          inputTokens: 20,
          outputTokens: 15,
        });
      }

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8192,
        messages: sampleMessages,
      });
    });

    it('should handle 429 rate limit error with retry', async () => {
      const rateLimitError = Object.assign(
        new Error('Rate limit exceeded'),
        {
          status: 429,
          message: 'Rate limit exceeded',
        }
      );

      mockAnthropic.messages = {
        create: jest
          .fn()
          .mockRejectedValueOnce(rateLimitError)
          .mockRejectedValueOnce(rateLimitError)
          .mockResolvedValue({
            id: 'msg_retry',
            type: 'message' as const,
            role: 'assistant' as const,
            content: [{ type: 'text' as const, text: 'Success after retry' }],
            model: 'claude-sonnet-4-5-20250929',
            stop_reason: 'end_turn' as const,
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
      } as any;

      jest.useFakeTimers();

      const resultPromise = adapter.sendMessage(sampleMessages);

      // Fast-forward through retries (2^0=1s, 2^1=2s)
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);

      const result = await resultPromise;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.content).toBe('Success after retry');
      }

      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should fail after max retries on 429 error', async () => {
      const rateLimitError = Object.assign(
        new Error('Rate limit exceeded'),
        {
          status: 429,
          message: 'Rate limit exceeded',
        }
      );

      mockAnthropic.messages = {
        create: jest.fn().mockRejectedValue(rateLimitError),
      } as any;

      jest.useFakeTimers();

      const resultPromise = adapter.sendMessage(sampleMessages);

      // Fast-forward through all retries
      for (let i = 0; i < 3; i++) {
        await jest.advanceTimersByTimeAsync(Math.pow(2, i) * 1000);
      }

      const result = await resultPromise;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('rate_limit');
        expect(result.error.message).toContain('レート制限');
      }

      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });

    it('should handle 401 authentication error', async () => {
      const authError = Object.assign(new Error('Invalid API key'), {
        status: 401,
        message: 'Invalid API key',
      });

      mockAnthropic.messages = {
        create: jest.fn().mockRejectedValue(authError),
      } as any;

      const result = await adapter.sendMessage(sampleMessages);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('auth');
        expect(result.error.message).toContain('認証エラー');
        expect(result.error.status).toBe(401);
      }

      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(1);
    });

    it('should handle 500 server error', async () => {
      const serverError = Object.assign(new Error('Internal server error'), {
        status: 500,
        message: 'Internal server error',
      });

      mockAnthropic.messages = {
        create: jest.fn().mockRejectedValue(serverError),
      } as any;

      const result = await adapter.sendMessage(sampleMessages);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('server');
        expect(result.error.message).toContain('サーバーエラー');
        expect(result.error.status).toBe(500);
      }
    });

    it('should handle timeout error', async () => {
      const timeoutError = new Error('Request timeout');

      mockAnthropic.messages = {
        create: jest.fn().mockRejectedValue(timeoutError),
      } as any;

      const result = await adapter.sendMessage(sampleMessages);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('timeout');
        expect(result.error.message).toContain('タイムアウト');
      }
    });

    it('should handle unknown errors', async () => {
      const unknownError = new Error('Something unexpected');

      mockAnthropic.messages = {
        create: jest.fn().mockRejectedValue(unknownError),
      } as any;

      const result = await adapter.sendMessage(sampleMessages);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unknown');
        expect(result.error.message).toBe('Something unexpected');
      }
    });

    it('should log successful API calls', async () => {
      const mockResponse = {
        id: 'msg_log_test',
        type: 'message' as const,
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: 'Response' }],
        model: 'claude-sonnet-4-5-20250929',
        stop_reason: 'end_turn' as const,
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 5 },
      };

      mockAnthropic.messages = {
        create: jest.fn().mockResolvedValue(mockResponse),
      } as any;

      await adapter.sendMessage(sampleMessages);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Claude API request',
        expect.objectContaining({
          messageCount: 3,
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Claude API response received',
        expect.objectContaining({
          inputTokens: 10,
          outputTokens: 5,
        })
      );
    });

    it('should log errors', async () => {
      const error = new Error('Test error');

      mockAnthropic.messages = {
        create: jest.fn().mockRejectedValue(error),
      } as any;

      await adapter.sendMessage(sampleMessages);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Claude API request failed',
        expect.any(Error),
        expect.objectContaining({
          errorType: 'unknown',
        })
      );
    });
  });

  describe('getTokenUsage', () => {
    it('should return accumulated token usage', async () => {
      const mockResponse1 = {
        id: 'msg_1',
        type: 'message' as const,
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: 'Response 1' }],
        model: 'claude-sonnet-4-5-20250929',
        stop_reason: 'end_turn' as const,
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 5 },
      };

      const mockResponse2 = {
        id: 'msg_2',
        type: 'message' as const,
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: 'Response 2' }],
        model: 'claude-sonnet-4-5-20250929',
        stop_reason: 'end_turn' as const,
        stop_sequence: null,
        usage: { input_tokens: 20, output_tokens: 15 },
      };

      mockAnthropic.messages = {
        create: jest
          .fn()
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2),
      } as any;

      await adapter.sendMessage([{ role: 'user', content: 'Test 1' }]);
      await adapter.sendMessage([{ role: 'user', content: 'Test 2' }]);

      const usage = adapter.getTokenUsage();

      expect(usage).toEqual({
        inputTokens: 30,
        outputTokens: 20,
        totalTokens: 50,
      });
    });

    it('should return zero usage when no API calls made', () => {
      const usage = adapter.getTokenUsage();

      expect(usage).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      });
    });
  });
});
