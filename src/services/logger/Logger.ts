/**
 * Logger Service
 * Provides structured logging with sensitive data masking
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { ConfigAdapter, ConfigKey } from '../../adapters/config/ConfigAdapter';

export interface LogContext {
  messageId?: string;
  threadId?: string;
  userId?: string;
  guildId?: string;
  operation?: string;
  duration?: number;
  [key: string]: unknown;
}

const SENSITIVE_PATTERNS = [
  // Anthropic API Key - match full key first
  { pattern: /sk-ant-[a-zA-Z0-9-_]{10,}/g, replacement: 'sk-ant-***' },
  { pattern: /ANTHROPIC_API_KEY=\S+/g, replacement: 'ANTHROPIC_API_KEY=***' },

  // Discord Token
  {
    pattern: /[MN][a-zA-Z\d_-]{23,25}\.[a-zA-Z\d_-]{6}\.[a-zA-Z\d_-]{27,}/g,
    replacement: 'DISCORD_TOKEN=***',
  },
  { pattern: /DISCORD_BOT_TOKEN=\S+/g, replacement: 'DISCORD_BOT_TOKEN=***' },

  // GitHub Token - match in URLs first, then standalone
  {
    pattern: /https?:\/\/([^:]+):([^@]+)@github\.com/g,
    replacement: 'https://github.com/***:***@',
  },
  { pattern: /ghp_[a-zA-Z0-9]{10,}/g, replacement: 'ghp_***' },
  { pattern: /GITHUB_TOKEN=\S+/g, replacement: 'GITHUB_TOKEN=***' },

  // Generic Bearer tokens
  { pattern: /Bearer\s+[a-zA-Z0-9\-_.]+/g, replacement: 'Bearer ***' },
];

export class Logger {
  private logger: winston.Logger;

  constructor(config: ConfigAdapter) {
    const logLevel = config.getOptional(ConfigKey.LOG_LEVEL, 'info');
    const logToFile = config.getOptional(ConfigKey.LOG_TO_FILE, 'true') === 'true';
    const logFilePath = config.getOptional(ConfigKey.LOG_FILE_PATH, '/app/logs');
    const logMaxSize = config.getOptional(ConfigKey.LOG_MAX_SIZE, '10m');
    const logMaxFiles = config.getOptional(ConfigKey.LOG_MAX_FILES, '7d');
    const logCompress = config.getOptional(ConfigKey.LOG_COMPRESS, 'true') === 'true';

    // Base format for all transports
    const baseFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    // Console transport
    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: baseFormat,
      }),
    ];

    // File transport (optional)
    if (logToFile) {
      transports.push(
        new DailyRotateFile({
          dirname: logFilePath,
          filename: 'discord-bot-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: logMaxSize,
          maxFiles: logMaxFiles,
          zippedArchive: logCompress,
          format: baseFormat,
        })
      );
    }

    this.logger = winston.createLogger({
      level: logLevel,
      transports,
    });
  }

  debug(message: string, context?: LogContext): void {
    const maskedMessage = this.maskSensitiveData(message);
    const maskedContext = context ? this.maskContextData(context) : undefined;
    this.logger.debug(maskedMessage, maskedContext);
  }

  info(message: string, context?: LogContext): void {
    const maskedMessage = this.maskSensitiveData(message);
    const maskedContext = context ? this.maskContextData(context) : undefined;
    this.logger.info(maskedMessage, maskedContext);
  }

  warn(message: string, context?: LogContext): void {
    const maskedMessage = this.maskSensitiveData(message);
    const maskedContext = context ? this.maskContextData(context) : undefined;
    this.logger.warn(maskedMessage, maskedContext);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const maskedMessage = this.maskSensitiveData(message);
    const maskedContext = context ? this.maskContextData(context) : undefined;

    if (error) {
      const maskedError = {
        name: error.name,
        message: this.maskSensitiveData(error.message),
        stack: error.stack ? this.maskSensitiveData(error.stack) : undefined,
      };

      this.logger.error(maskedMessage, {
        ...maskedContext,
        error: maskedError,
      });
    } else {
      this.logger.error(maskedMessage, maskedContext);
    }
  }

  maskSensitiveData(text: string): string {
    if (!text) return text;

    let masked = text;
    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
      masked = masked.replace(pattern, replacement);
    }
    return masked;
  }

  private maskContextData(context: LogContext): LogContext {
    const masked: LogContext = {};

    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        masked[key] = this.maskSensitiveData(value);
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }
}
