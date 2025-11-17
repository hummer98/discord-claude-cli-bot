import { StatusService } from '../StatusService';
import { GitAdapter } from '../../../adapters/git/GitAdapter';
import { ClaudeCliAdapter } from '../../../adapters/claude/ClaudeCliAdapter';

// Mock dependencies
jest.mock('../../../adapters/git/GitAdapter');
jest.mock('../../../adapters/claude/ClaudeCliAdapter');

describe('StatusService', () => {
  let statusService: StatusService;
  let mockGitAdapter: jest.Mocked<GitAdapter>;
  let mockClaudeAdapter: jest.Mocked<ClaudeCliAdapter>;
  const mockStartTime = new Date('2025-11-16T00:00:00Z');

  beforeEach(() => {
    mockGitAdapter = {
      getStatus: jest.fn(),
    } as any;

    mockClaudeAdapter = {
      getTokenUsage: jest.fn().mockReturnValue({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      }),
    } as any;

    statusService = new StatusService(mockGitAdapter, mockClaudeAdapter, mockStartTime);
  });

  describe('getStatusInfo', () => {
    it('Git情報とClaude情報を並列取得してステータスを返す', async () => {
      // Arrange
      mockGitAdapter.getStatus.mockResolvedValue({
        ok: true,
        value: {
          branch: 'main',
          clean: true,
          modified: [],
          tracking: 'origin/main',
        },
      });

      mockClaudeAdapter.getTokenUsage.mockReturnValue({
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      });

      // Act
      const result = await statusService.getStatusInfo();

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('# Bot Status');
        expect(result.value).toContain('**Branch:** main');
        expect(result.value).toContain('**Tracking:** origin/main');
        expect(result.value).toContain('**Status:** Clean');
        expect(result.value).toContain('**Input Tokens:** 1,000');
        expect(result.value).toContain('**Output Tokens:** 500');
        expect(result.value).toContain('**Uptime:**');
      }
    });

    it('変更されたファイルがある場合、ステータスに表示する', async () => {
      // Arrange
      mockGitAdapter.getStatus.mockResolvedValue({
        ok: true,
        value: {
          branch: 'feature/test',
          clean: false,
          modified: ['src/index.ts', 'README.md'],
          tracking: 'origin/feature/test',
        },
      });

      mockClaudeAdapter.getTokenUsage.mockReturnValue({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      });

      // Act
      const result = await statusService.getStatusInfo();

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('**Status:** Modified (2 files)');
        expect(result.value).toContain('- src/index.ts');
        expect(result.value).toContain('- README.md');
      }
    });

    it('Gitエラー時でも部分的なステータスを返す', async () => {
      // Arrange
      mockGitAdapter.getStatus.mockResolvedValue({
        ok: false,
        error: new Error('Git command failed'),
      });

      mockClaudeAdapter.getTokenUsage.mockReturnValue({
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      });

      // Act
      const result = await statusService.getStatusInfo();

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('# Bot Status');
        expect(result.value).toContain('**Git:** Error: Git command failed');
        expect(result.value).toContain('**Input Tokens:** 1,000');
      }
    });

    it('トークン使用量がゼロの場合でも表示する', async () => {
      // Arrange
      mockGitAdapter.getStatus.mockResolvedValue({
        ok: true,
        value: {
          branch: 'main',
          clean: true,
          modified: [],
          tracking: 'origin/main',
        },
      });

      mockClaudeAdapter.getTokenUsage.mockReturnValue({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      });

      // Act
      const result = await statusService.getStatusInfo();

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('**Input Tokens:** 0');
        expect(result.value).toContain('**Output Tokens:** 0');
      }
    });

    it('稼働時間を適切にフォーマットする', async () => {
      // Arrange
      const startTime = new Date(Date.now() - 3661000); // 1 hour, 1 minute, 1 second ago
      const service = new StatusService(mockGitAdapter, mockClaudeAdapter, startTime);

      mockGitAdapter.getStatus.mockResolvedValue({
        ok: true,
        value: {
          branch: 'main',
          clean: true,
          modified: [],
        },
      });

      mockClaudeAdapter.getTokenUsage.mockReturnValue({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      });

      // Act
      const result = await service.getStatusInfo();

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toMatch(/\*\*Uptime:\*\* \d+h \d+m \d+s/);
      }
    });

    it('Git情報を取得する（Claude情報は同期的に取得）', async () => {
      // Arrange
      mockGitAdapter.getStatus.mockResolvedValue({
        ok: true,
        value: {
          branch: 'main',
          clean: true,
          modified: [],
        },
      });

      mockClaudeAdapter.getTokenUsage.mockReturnValue({
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      });

      // Act
      const result = await statusService.getStatusInfo();

      // Assert
      expect(mockGitAdapter.getStatus).toHaveBeenCalled();
      expect(mockClaudeAdapter.getTokenUsage).toHaveBeenCalled();
      expect(result.ok).toBe(true);
    });
  });

  describe('formatUptime', () => {
    it('1時間未満の場合、分と秒を表示する', () => {
      const service = new StatusService(mockGitAdapter, mockClaudeAdapter, new Date());
      const uptime = (service as any).formatUptime(3661); // 1h 1m 1s in seconds
      expect(uptime).toBe('1h 1m 1s');
    });

    it('1分未満の場合、秒のみ表示する', () => {
      const service = new StatusService(mockGitAdapter, mockClaudeAdapter, new Date());
      const uptime = (service as any).formatUptime(45);
      expect(uptime).toBe('45s');
    });

    it('0秒の場合、0sを表示する', () => {
      const service = new StatusService(mockGitAdapter, mockClaudeAdapter, new Date());
      const uptime = (service as any).formatUptime(0);
      expect(uptime).toBe('0s');
    });
  });
});
