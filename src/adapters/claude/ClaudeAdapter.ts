/**
 * ClaudeAdapter
 * Integrates with Anthropic Claude API using official TypeScript SDK
 */

import Anthropic from '@anthropic-ai/sdk';
import { ConfigAdapter, ConfigKey } from '../config/ConfigAdapter';
import { Logger } from '../../services/logger/Logger';
import { Result, ok, err } from '../../types/Result';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  } | undefined;
}

export interface ClaudeError {
  type: 'rate_limit' | 'auth' | 'server' | 'timeout' | 'unknown';
  message: string;
  status?: number;
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

const MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = 8192;
const MAX_RETRIES = 3;

export class ClaudeAdapter {
  private client: Anthropic;
  private logger: Logger;
  private tokenUsage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };

  constructor(config: ConfigAdapter, logger: Logger) {
    const apiKey = config.get(ConfigKey.ANTHROPIC_API_KEY);

    this.client = new Anthropic({
      apiKey,
    });

    this.logger = logger;

    this.logger.info('ClaudeAdapter initialized', {
      model: MODEL,
    });
  }

  /**
   * Send messages to Claude API with retry logic for rate limits
   */
  async sendMessage(
    messages: ClaudeMessage[]
  ): Promise<Result<ClaudeResponse, ClaudeError>> {
    this.logger.info('Claude API request', {
      messageCount: messages.length,
    });

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          messages: messages,
        });

        // Extract text content
        const content = response.content
          .filter((block) => block.type === 'text')
          .map((block) => (block as { type: 'text'; text: string }).text)
          .join('\n');

        // Track token usage
        if (response.usage) {
          this.tokenUsage.inputTokens += response.usage.input_tokens;
          this.tokenUsage.outputTokens += response.usage.output_tokens;
          this.tokenUsage.totalTokens += response.usage.input_tokens + response.usage.output_tokens;

          this.logger.info('Claude API response received', {
            inputTokens: response.usage.input_tokens,
            outputTokens: this.tokenUsage.outputTokens,
          });
        }

        return ok({
          content,
          usage: response.usage
            ? {
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
              }
            : undefined,
        });
      } catch (error) {
        const claudeError = this.handleError(error, attempt);

        // Only retry on rate limit errors
        if (claudeError.type === 'rate_limit' && attempt < MAX_RETRIES - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          this.logger.warn(
            `Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
            {
              attempt: attempt + 1,
              maxRetries: MAX_RETRIES,
              delay,
            }
          );
          await this.sleep(delay);
          continue;
        }

        // Log error and return
        this.logger.error('Claude API request failed', error as Error, {
          errorType: claudeError.type,
          status: claudeError.status,
          attempt: attempt + 1,
        });

        return err(claudeError);
      }
    }

    // Should never reach here, but TypeScript needs this
    return err({
      type: 'unknown',
      message: 'リトライ回数の上限に達しました',
    });
  }

  /**
   * Get accumulated token usage statistics
   */
  getTokenUsage(): TokenUsage {
    return { ...this.tokenUsage };
  }

  /**
   * Handle API errors and classify them
   */
  private handleError(error: unknown, _attempt: number): ClaudeError {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      const message =
        'message' in error ? String((error as { message: string }).message) : '不明なエラー';

      switch (status) {
        case 429:
          return {
            type: 'rate_limit',
            message: `レート制限に達しました: ${message}`,
            status,
          };
        case 401:
          return {
            type: 'auth',
            message: `認証エラー: APIキーが無効です - ${message}`,
            status,
          };
        case 500:
        case 502:
        case 503:
        case 504:
          return {
            type: 'server',
            message: `サーバーエラー: Claude APIで問題が発生しています - ${message}`,
            status,
          };
        default:
          return {
            type: 'unknown',
            message: `APIエラー (${status}): ${message}`,
            status,
          };
      }
    }

    // Timeout or network errors
    if (error instanceof Error) {
      if (error.message.toLowerCase().includes('timeout')) {
        return {
          type: 'timeout',
          message: `タイムアウト: Claude APIへの接続がタイムアウトしました - ${error.message}`,
        };
      }

      return {
        type: 'unknown',
        message: error.message,
      };
    }

    return {
      type: 'unknown',
      message: String(error),
    };
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
