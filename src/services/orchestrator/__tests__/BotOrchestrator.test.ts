import { BotOrchestrator } from '../BotOrchestrator';
import { ConversationService } from '../../conversation/ConversationService';
import { StatusService } from '../../status/StatusService';
import { GitAdapter } from '../../../adapters/git/GitAdapter';
import { ThreadManager } from '../../discord/ThreadManager';
import { Message, ThreadChannel } from 'discord.js';

// Mock all dependencies
jest.mock('../../conversation/ConversationService');
jest.mock('../../status/StatusService');
jest.mock('../../../adapters/git/GitAdapter');
jest.mock('../../discord/ThreadManager');

describe('BotOrchestrator', () => {
  let orchestrator: BotOrchestrator;
  let mockConversationService: jest.Mocked<ConversationService>;
  let mockStatusService: jest.Mocked<StatusService>;
  let mockGitAdapter: jest.Mocked<GitAdapter>;
  let mockThreadManager: jest.Mocked<ThreadManager>;
  let mockMessage: jest.Mocked<Message>;
  let mockThread: jest.Mocked<ThreadChannel>;

  beforeEach(() => {
    mockConversationService = {
      processConversation: jest.fn(),
    } as any;

    mockStatusService = {
      getStatusInfo: jest.fn(),
    } as any;

    mockGitAdapter = {
      checkForUpdates: jest.fn(),
      pullChanges: jest.fn(),
    } as any;

    mockThreadManager = {
      createOrGetThread: jest.fn(),
      fetchThreadHistory: jest.fn(),
      sendToThread: jest.fn(),
      sendTypingIndicator: jest.fn(),
    } as any;

    mockMessage = {
      id: 'msg-123',
      content: '@bot Hello',
      channel: {
        isThread: () => false,
      },
    } as any;

    mockThread = {
      id: 'thread-123',
      name: 'Test Thread',
    } as any;

    orchestrator = new BotOrchestrator(
      mockConversationService,
      mockStatusService,
      mockGitAdapter,
      mockThreadManager
    );
  });

  describe('processChatCommand', () => {
    it('新規スレッドの場合、Git同期チェックを実行する', async () => {
      // Arrange
      const command = {
        type: 'chat' as const,
        content: 'Hello',
        message: mockMessage,
      };

      mockThreadManager.createOrGetThread.mockResolvedValue({
        ok: true,
        value: mockThread,
      });

      mockGitAdapter.checkForUpdates.mockResolvedValue({
        ok: true,
        value: {
          hasUpdates: false,
          behind: 0,
          ahead: 0,
        },
      });

      mockThreadManager.fetchThreadHistory.mockResolvedValue({
        ok: true,
        value: [],
      });

      mockConversationService.processConversation.mockResolvedValue({
        ok: true,
        value: 'Hello! How can I help you?',
      });

      mockThreadManager.sendToThread.mockResolvedValue({
        ok: true,
        value: {} as Message,
      });

      // Act
      await orchestrator.processChatCommand(command);

      // Assert
      expect(mockGitAdapter.checkForUpdates).toHaveBeenCalled();
      expect(mockThreadManager.sendTypingIndicator).toHaveBeenCalledWith(mockThread);
      expect(mockConversationService.processConversation).toHaveBeenCalled();
      expect(mockThreadManager.sendToThread).toHaveBeenCalled();
    });

    it('スレッド内メッセージの場合、Git同期チェックをスキップする', async () => {
      // Arrange
      const threadMessage = {
        ...mockMessage,
        channel: {
          isThread: () => true,
        },
      } as any;

      const command = {
        type: 'chat' as const,
        content: 'Follow up question',
        message: threadMessage,
        thread: mockThread,
      };

      mockThreadManager.fetchThreadHistory.mockResolvedValue({
        ok: true,
        value: [],
      });

      mockConversationService.processConversation.mockResolvedValue({
        ok: true,
        value: 'Sure, let me help!',
      });

      mockThreadManager.sendToThread.mockResolvedValue({
        ok: true,
        value: {} as Message,
      });

      // Act
      await orchestrator.processChatCommand(command);

      // Assert
      expect(mockGitAdapter.checkForUpdates).not.toHaveBeenCalled();
      expect(mockThreadManager.sendTypingIndicator).toHaveBeenCalledWith(mockThread);
    });

    it('Git更新がある場合、pullして通知する', async () => {
      // Arrange
      const command = {
        type: 'chat' as const,
        content: 'Hello',
        message: mockMessage,
      };

      mockThreadManager.createOrGetThread.mockResolvedValue({
        ok: true,
        value: mockThread,
      });

      mockGitAdapter.checkForUpdates.mockResolvedValue({
        ok: true,
        value: {
          hasUpdates: true,
          behind: 2,
          ahead: 0,
        },
      });

      mockGitAdapter.pullChanges.mockResolvedValue({
        ok: true,
        value: {
          updated: true,
          summary: 'Updated: 2 commits, 3 files changed',
          files: ['file1.ts', 'file2.ts', 'file3.ts'],
        },
      });

      mockThreadManager.fetchThreadHistory.mockResolvedValue({
        ok: true,
        value: [],
      });

      mockConversationService.processConversation.mockResolvedValue({
        ok: true,
        value: 'Response',
      });

      mockThreadManager.sendToThread.mockResolvedValue({
        ok: true,
        value: {} as Message,
      });

      // Act
      await orchestrator.processChatCommand(command);

      // Assert
      expect(mockGitAdapter.pullChanges).toHaveBeenCalled();
      expect(mockThreadManager.sendToThread).toHaveBeenCalledTimes(2); // Git notification + Claude response
    });

    it('Claude API エラー時、エラーメッセージをスレッドに送信する', async () => {
      // Arrange
      const command = {
        type: 'chat' as const,
        content: 'Hello',
        message: mockMessage,
      };

      mockThreadManager.createOrGetThread.mockResolvedValue({
        ok: true,
        value: mockThread,
      });

      mockGitAdapter.checkForUpdates.mockResolvedValue({
        ok: true,
        value: { hasUpdates: false, behind: 0, ahead: 0 },
      });

      mockThreadManager.fetchThreadHistory.mockResolvedValue({
        ok: true,
        value: [],
      });

      mockConversationService.processConversation.mockResolvedValue({
        ok: false,
        error: {
          type: 'cli_error' as const,
          message: 'Rate limit exceeded',
        },
      });

      mockThreadManager.sendToThread.mockResolvedValue({
        ok: true,
        value: {} as Message,
      });

      // Act
      await orchestrator.processChatCommand(command);

      // Assert
      expect(mockThreadManager.sendToThread).toHaveBeenCalledWith(
        mockThread,
        expect.stringContaining('Rate limit exceeded')
      );
    });

    it('スレッド作成エラー時、処理を中断する', async () => {
      // Arrange
      const command = {
        type: 'chat' as const,
        content: 'Hello',
        message: mockMessage,
      };

      mockThreadManager.createOrGetThread.mockResolvedValue({
        ok: false,
        error: {
          type: 'creation_failed' as const,
          message: 'Cannot create thread in DM',
        },
      });

      // Act
      await orchestrator.processChatCommand(command);

      // Assert
      expect(mockConversationService.processConversation).not.toHaveBeenCalled();
    });
  });

  describe('processStatusCommand', () => {
    it('ステータス情報を取得してスレッドに送信する', async () => {
      // Arrange
      const command = {
        type: 'status' as const,
        content: 'status',
        message: mockMessage,
        thread: mockThread,
      };

      mockStatusService.getStatusInfo.mockResolvedValue({
        ok: true,
        value: '# Bot Status\n\n**Branch:** main\n**Uptime:** 1h 30m 0s\n',
      });

      mockThreadManager.sendToThread.mockResolvedValue({
        ok: true,
        value: {} as Message,
      });

      // Act
      await orchestrator.processStatusCommand(command);

      // Assert
      expect(mockStatusService.getStatusInfo).toHaveBeenCalled();
      expect(mockThreadManager.sendToThread).toHaveBeenCalledWith(
        mockThread,
        expect.stringContaining('# Bot Status')
      );
    });

    it('ステータス取得エラー時、エラーメッセージを送信する', async () => {
      // Arrange
      const command = {
        type: 'status' as const,
        content: 'status',
        message: mockMessage,
        thread: mockThread,
      };

      mockStatusService.getStatusInfo.mockResolvedValue({
        ok: false,
        error: new Error('Failed to get status'),
      });

      mockThreadManager.sendToThread.mockResolvedValue({
        ok: true,
        value: {} as Message,
      });

      // Act
      await orchestrator.processStatusCommand(command);

      // Assert
      expect(mockThreadManager.sendToThread).toHaveBeenCalledWith(
        mockThread,
        expect.stringContaining('Failed to get status')
      );
    });
  });

  describe('processMessage', () => {
    it('chat コマンドを processChatCommand に委譲する', async () => {
      // Arrange
      const command = {
        type: 'chat' as const,
        content: 'Hello',
        message: mockMessage,
      };

      // Spy on processChatCommand
      const processChatSpy = jest.spyOn(orchestrator, 'processChatCommand');
      processChatSpy.mockResolvedValue(undefined);

      // Act
      await orchestrator.processMessage(command);

      // Assert
      expect(processChatSpy).toHaveBeenCalledWith(command);

      processChatSpy.mockRestore();
    });

    it('status コマンドを processStatusCommand に委譲する', async () => {
      // Arrange
      const command = {
        type: 'status' as const,
        content: 'status',
        message: mockMessage,
        thread: mockThread,
      };

      // Spy on processStatusCommand
      const processStatusSpy = jest.spyOn(orchestrator, 'processStatusCommand');
      processStatusSpy.mockResolvedValue(undefined);

      // Act
      await orchestrator.processMessage(command);

      // Assert
      expect(processStatusSpy).toHaveBeenCalledWith(command);

      processStatusSpy.mockRestore();
    });

    it('エラー発生時も他のメッセージ処理を妨げない', async () => {
      // Arrange
      const command = {
        type: 'chat' as const,
        content: 'Hello',
        message: mockMessage,
      };

      const processChatSpy = jest.spyOn(orchestrator, 'processChatCommand');
      processChatSpy.mockRejectedValue(new Error('Processing failed'));

      // Act & Assert - should not throw
      await expect(orchestrator.processMessage(command)).resolves.not.toThrow();

      processChatSpy.mockRestore();
    });
  });
});
