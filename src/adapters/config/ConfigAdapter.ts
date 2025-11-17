/**
 * ConfigAdapter
 * Manages environment variables and configuration settings
 */

import * as dotenv from 'dotenv';
import { Result, ok, err } from '../../types/Result';

// Load environment variables from .env file
dotenv.config();

export enum ConfigKey {
  DISCORD_BOT_TOKEN = 'DISCORD_BOT_TOKEN',
  ANTHROPIC_AUTH_TOKEN = 'ANTHROPIC_AUTH_TOKEN',
  ANTHROPIC_API_KEY = 'ANTHROPIC_API_KEY',
  CLAUDE_CODE_OAUTH_TOKEN = 'CLAUDE_CODE_OAUTH_TOKEN',
  GITHUB_TOKEN = 'GITHUB_TOKEN',
  GIT_REPOSITORY_URL = 'GIT_REPOSITORY_URL',
  BOT_NAME = 'BOT_NAME',
  LOG_LEVEL = 'LOG_LEVEL',
  LOG_TO_FILE = 'LOG_TO_FILE',
  LOG_FILE_PATH = 'LOG_FILE_PATH',
  LOG_MAX_SIZE = 'LOG_MAX_SIZE',
  LOG_MAX_FILES = 'LOG_MAX_FILES',
  LOG_COMPRESS = 'LOG_COMPRESS',
  MAX_THREAD_HISTORY = 'MAX_THREAD_HISTORY',
}

export interface ConfigError {
  key: ConfigKey;
  reason: 'missing' | 'invalid_format';
}

const REQUIRED_KEYS: ConfigKey[] = [
  ConfigKey.DISCORD_BOT_TOKEN,
  ConfigKey.GIT_REPOSITORY_URL,
];

export class ConfigAdapter {
  /**
   * Validate that all required environment variables are set
   */
  validate(): Result<void, ConfigError[]> {
    const errors: ConfigError[] = [];

    // Check required keys
    for (const key of REQUIRED_KEYS) {
      const value = process.env[key];
      if (!value || value.trim() === '') {
        errors.push({
          key,
          reason: 'missing',
        });
      }
    }

    // Note: Claude authentication check is disabled to allow testing OAuth flow
    // The Claude CLI will handle authentication validation

    if (errors.length > 0) {
      return err(errors);
    }

    return ok(undefined);
  }

  /**
   * Get a required environment variable value
   * @throws Error if the variable is not set
   */
  get(key: ConfigKey): string {
    const value = process.env[key];

    if (!value || value.trim() === '') {
      throw new Error(
        `Required environment variable ${key} is not set. Please check your .env file.`
      );
    }

    return value;
  }

  /**
   * Get an optional environment variable value with a default
   */
  getOptional<T extends string>(key: ConfigKey, defaultValue: T): string {
    const value = process.env[key];

    if (!value || value.trim() === '') {
      return defaultValue;
    }

    return value;
  }

  /**
   * Format validation errors into a human-readable message
   */
  formatValidationErrors(errors: ConfigError[]): string {
    const messages = errors.map((error) => {
      if (error.reason === 'missing') {
        if (error.key === ConfigKey.ANTHROPIC_AUTH_TOKEN) {
          return `  - ${error.key} or ANTHROPIC_API_KEY: Claude認証情報が設定されていません`;
        }
        return `  - ${error.key}: 環境変数が設定されていません`;
      }
      return `  - ${error.key}: 形式が無効です`;
    });

    return [
      '必須の環境変数が不足しています:',
      ...messages,
      '',
      'Claude認証には以下のいずれかが必要です:',
      '  - CLAUDE_CODE_OAUTH_TOKEN (OAuth, GitHub Actions style - 推奨)',
      '  - ANTHROPIC_API_KEY (API Key, pay-as-you-go)',
      '',
      '.env ファイルを確認してください。',
      '.env.example を参考にしてください。',
    ].join('\n');
  }
}
