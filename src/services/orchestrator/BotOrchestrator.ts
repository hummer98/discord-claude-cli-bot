/**
 * BotOrchestrator
 * Coordinates message processing flow between all services
 */

import { ThreadChannel } from 'discord.js';
import { Command } from '../discord/MessageHandler';
import { ConversationService } from '../conversation/ConversationService';
import { StatusService } from '../status/StatusService';
import { GitAdapter } from '../../adapters/git/GitAdapter';
import { ThreadManager } from '../discord/ThreadManager';
import { Logger } from '../logger/Logger';

export class BotOrchestrator {
  private conversationService: ConversationService;
  private statusService: StatusService;
  private gitAdapter: GitAdapter;
  private threadManager: ThreadManager;
  private logger: Logger | undefined;

  constructor(
    conversationService: ConversationService,
    statusService: StatusService,
    gitAdapter: GitAdapter,
    threadManager: ThreadManager,
    logger?: Logger
  ) {
    this.conversationService = conversationService;
    this.statusService = statusService;
    this.gitAdapter = gitAdapter;
    this.threadManager = threadManager;
    this.logger = logger || undefined;
  }

  /**
   * Process incoming command
   */
  async processMessage(command: Command): Promise<void> {
    try {
      if (command.type === 'status') {
        await this.processStatusCommand(command);
      } else {
        await this.processChatCommand(command);
      }
    } catch (error) {
      this.logger?.error(
        'Error processing message',
        error instanceof Error ? error : new Error(String(error)),
        {
          messageId: command.message.id,
          commandType: command.type,
        }
      );
      // Error should not propagate to prevent affecting other message processing
    }
  }

  /**
   * Process chat command
   */
  async processChatCommand(command: Command): Promise<void> {
    // Step 1: Create or get thread
    const threadResult = command.thread
      ? { ok: true as const, value: command.thread }
      : await this.threadManager.createOrGetThread(command.message);

    if (!threadResult.ok) {
      this.logger?.error('Failed to create thread', new Error(threadResult.error.message), {
        messageId: command.message.id,
        errorType: threadResult.error.type,
      });
      return;
    }

    const thread = threadResult.value;

    // Step 2: Send typing indicator
    await this.threadManager.sendTypingIndicator(thread);

    // Step 3: Check for Git updates (only for new threads, not within existing threads)
    const isNewThread = !command.message.channel.isThread();
    if (isNewThread) {
      await this.checkAndPullGitUpdates(thread);
    }

    // Step 4: Fetch thread history
    const historyResult = await this.threadManager.fetchThreadHistory(thread);
    if (!historyResult.ok) {
      this.logger?.error('Failed to fetch thread history', new Error(historyResult.error.message), {
        threadId: thread.id,
        errorType: historyResult.error.type,
      });
      await this.threadManager.sendToThread(
        thread,
        'エラー: スレッド履歴の取得に失敗しました。'
      );
      return;
    }

    // Step 5: Process conversation with Claude
    const conversationResult = await this.conversationService.processConversation(
      historyResult.value,
      command.content
    );

    if (!conversationResult.ok) {
      const error = conversationResult.error;
      let errorMessage = `Claude CLIエラー: ${error.message}`;

      if (error.type === 'auth') {
        errorMessage = `認証エラー: ${error.message}\n\nANTHROPIC_AUTH_TOKENまたはANTHROPIC_API_KEYを確認してください。`;
      } else if (error.type === 'timeout') {
        errorMessage = `タイムアウト: ${error.message}\n\nもう一度お試しください。`;
      } else if (error.type === 'cli_error') {
        errorMessage = `Claude CLIエラー: ${error.message}`;
      }

      await this.threadManager.sendToThread(thread, errorMessage);
      return;
    }

    // Step 6: Send response to thread
    await this.threadManager.sendToThread(thread, conversationResult.value);
  }

  /**
   * Process status command
   */
  async processStatusCommand(command: Command): Promise<void> {
    let thread = command.thread;

    if (!thread) {
      const threadResult = await this.threadManager.createOrGetThread(command.message);
      if (!threadResult.ok) {
        this.logger?.error('Failed to get thread for status command', new Error(threadResult.error.message), {
          messageId: command.message.id,
        });
        return;
      }
      thread = threadResult.value;
    }

    const statusResult = await this.statusService.getStatusInfo();

    if (!statusResult.ok) {
      await this.threadManager.sendToThread(
        thread,
        `ステータス取得エラー: ${statusResult.error.message}`
      );
      return;
    }

    await this.threadManager.sendToThread(thread, statusResult.value);
  }

  /**
   * Check for Git updates and pull if necessary
   */
  private async checkAndPullGitUpdates(thread: ThreadChannel): Promise<void> {
    try {
      const updateCheckResult = await this.gitAdapter.checkForUpdates();

      if (!updateCheckResult.ok) {
        this.logger?.warn('Git update check failed', {
          error: updateCheckResult.error.message,
        });
        return;
      }

      const updateInfo = updateCheckResult.value;

      if (!updateInfo.hasUpdates) {
        this.logger?.info('Git repository is up to date');
        return;
      }

      // Pull changes
      this.logger?.info('Pulling Git changes', {
        behind: updateInfo.behind,
        ahead: updateInfo.ahead,
      });

      const pullResult = await this.gitAdapter.pullChanges();

      if (!pullResult.ok) {
        this.logger?.error('Git pull failed', new Error(pullResult.error.message));
        await this.threadManager.sendToThread(
          thread,
          `Git更新エラー: ${pullResult.error.message}\n\n処理は続行します。`
        );
        return;
      }

      if (pullResult.value.updated) {
        const notification = `📥 **Git更新完了**\n${pullResult.value.summary}\n`;
        await this.threadManager.sendToThread(thread, notification);
      }
    } catch (error) {
      this.logger?.error(
        'Unexpected error during Git sync',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
