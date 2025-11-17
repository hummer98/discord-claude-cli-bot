/**
 * ClaudeCliAdapter
 * Integrates with Claude Code CLI using GitHub Actions style authentication
 * This adapter executes the Claude CLI directly instead of using the SDK
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { ConfigAdapter } from '../config/ConfigAdapter';
import { Logger } from '../../services/logger/Logger';
import { Result, ok, err } from '../../types/Result';

const execAsync = promisify(exec);

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ClaudeError {
  type: 'cli_error' | 'auth' | 'timeout' | 'unknown';
  message: string;
  stderr?: string;
}

const MAX_RETRIES = 3;
const TIMEOUT_MS = 180000; // 3 minutes

export class ClaudeCliAdapter {
  private logger: Logger;
  private workingDir: string;

  constructor(_config: ConfigAdapter, logger: Logger, workingDir?: string) {
    this.logger = logger;
    this.workingDir = workingDir || process.cwd();

    this.logger.info('ClaudeCliAdapter initialized (GitHub Actions style)', {
      workingDir: this.workingDir,
    });

    // Verify authentication on startup
    this.verifyAuthentication();
  }

  /**
   * Verify Claude CLI authentication status
   */
  private async verifyAuthentication(): Promise<void> {
    try {
      const { stdout } = await execAsync('claude --version', {
        env: process.env,
        timeout: 5000,
      });

      const authMethod = process.env['ANTHROPIC_AUTH_TOKEN']
        ? 'OAuth (ANTHROPIC_AUTH_TOKEN)'
        : process.env['ANTHROPIC_API_KEY']
        ? 'API Key (ANTHROPIC_API_KEY)'
        : 'Unknown';

      this.logger.info('Claude CLI ready', {
        version: stdout.trim(),
        authMethod,
      });
    } catch (error) {
      this.logger.error('Claude CLI verification failed', error as Error, {
        hint: 'Check if Claude Code CLI is installed and authenticated',
      });
    }
  }

  /**
   * Send messages to Claude Code CLI
   * GitHub Actions style: Executes claude command directly with environment variables
   */
  async sendMessage(
    messages: ClaudeMessage[]
  ): Promise<Result<ClaudeResponse, ClaudeError>> {
    this.logger.info('Claude CLI request', {
      messageCount: messages.length,
    });

    // Extract the last user message as the prompt
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
    if (!lastUserMessage) {
      return err({
        type: 'cli_error',
        message: 'No user message found',
      });
    }

    // Retry logic for transient errors
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await this.executeClaudeCLI(lastUserMessage.content);

        if (result.ok) {
          return result;
        }

        // Retry on timeout or server errors
        if (
          result.error.type === 'timeout' ||
          (result.error.type === 'cli_error' && attempt < MAX_RETRIES - 1)
        ) {
          const delay = Math.pow(2, attempt) * 1000;
          this.logger.warn(`Retrying Claude CLI in ${delay}ms`, {
            attempt: attempt + 1,
            maxRetries: MAX_RETRIES,
            errorType: result.error.type,
          });
          await this.sleep(delay);
          continue;
        }

        // Don't retry on auth errors
        return result;
      } catch (error) {
        this.logger.error('Claude CLI execution error', error as Error, {
          attempt: attempt + 1,
        });

        if (attempt === MAX_RETRIES - 1) {
          return err({
            type: 'unknown',
            message: `Failed after ${MAX_RETRIES} attempts`,
          });
        }
      }
    }

    return err({
      type: 'unknown',
      message: 'Max retries exceeded',
    });
  }

  /**
   * Execute Claude CLI command
   */
  private async executeClaudeCLI(
    prompt: string
  ): Promise<Result<ClaudeResponse, ClaudeError>> {
    const escapedPrompt = this.escapePrompt(prompt);
    // Close stdin to prevent Claude CLI from waiting for input
    const command = `claude --print "${escapedPrompt}" < /dev/null`;

    this.logger.debug('Executing Claude CLI', {
      command,
      promptLength: prompt.length,
      workingDir: this.workingDir,
    });

    try {
      // Pass environment variables directly to Claude CLI
      // Claude CLI will use CLAUDE_CODE_OAUTH_TOKEN automatically
      // Use shell: false to avoid shell interpretation issues
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workingDir,
        env: process.env,
        timeout: TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024, // 10MB
        shell: '/bin/bash',
      });

      if (stderr && stderr.trim()) {
        // Log stderr but don't treat as error if stdout exists
        this.logger.warn('Claude CLI stderr output', {
          stderr: stderr.substring(0, 500),
        });
      }

      const content = stdout.trim();

      this.logger.info('Claude CLI response received', {
        outputLength: content.length,
      });

      return ok({
        content,
        // Note: CLI doesn't provide token usage in stdout
        // Return default values for now
        usage: {
          inputTokens: 0,
          outputTokens: 0,
        },
      });
    } catch (error) {
      return err(this.handleError(error));
    }
  }

  /**
   * Escape prompt for shell execution (prevent shell injection)
   */
  private escapePrompt(prompt: string): string {
    return prompt
      .replace(/\\/g, '\\\\') // Escape backslashes
      .replace(/"/g, '\\"') // Escape double quotes
      .replace(/\$/g, '\\$') // Escape dollar signs
      .replace(/`/g, '\\`') // Escape backticks
      .replace(/!/g, '\\!'); // Escape exclamation marks
  }

  /**
   * Handle CLI execution errors
   */
  private handleError(error: unknown): ClaudeError {
    if (error && typeof error === 'object') {
      const execError = error as {
        code?: number;
        stderr?: string;
        stdout?: string;
        message: string;
        killed?: boolean;
        signal?: string;
      };

      // Timeout error
      if (execError.killed || execError.signal === 'SIGTERM') {
        return {
          type: 'timeout',
          message: 'Claude CLI execution timeout',
          stderr: execError.stderr || '',
        };
      }

      // Authentication error detection
      const stderr = (execError.stderr || '').toLowerCase();
      const stdout = (execError.stdout || '').toLowerCase();
      const combined = stderr + stdout;

      if (
        combined.includes('not authenticated') ||
        combined.includes('login') ||
        combined.includes('api key') ||
        combined.includes('unauthorized') ||
        combined.includes('authentication failed')
      ) {
        return {
          type: 'auth',
          message:
            'Claude CLI authentication failed. Set ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY',
          stderr: execError.stderr || '',
        };
      }

      // CLI error with stderr
      if (execError.stderr) {
        return {
          type: 'cli_error',
          message: execError.message,
          stderr: execError.stderr,
        };
      }

      return {
        type: 'cli_error',
        message: execError.message,
      };
    }

    if (error instanceof Error) {
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
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get token usage (not available from CLI)
   * Kept for interface compatibility
   */
  getTokenUsage(): { inputTokens: number; outputTokens: number; totalTokens: number } {
    this.logger.debug('Token usage not available from Claude CLI');
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
  }
}
