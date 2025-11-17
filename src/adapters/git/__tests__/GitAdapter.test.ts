/**
 * GitAdapter Test
 * Tests Git repository management and synchronization
 */

import { GitAdapter } from '../GitAdapter';
import { ConfigAdapter } from '../../config/ConfigAdapter';
import { Logger } from '../../../services/logger/Logger';
import simpleGit, { SimpleGit } from 'simple-git';

// Mock simple-git
jest.mock('simple-git');

describe('GitAdapter', () => {
  let gitAdapter: GitAdapter;
  let config: ConfigAdapter;
  let logger: Logger;
  let mockGit: jest.Mocked<SimpleGit>;

  beforeEach(() => {
    // Set up minimal config
    process.env['DISCORD_BOT_TOKEN'] = 'test-token';
    process.env['ANTHROPIC_API_KEY'] = 'test-key';
    process.env['GIT_REPOSITORY_URL'] = 'https://github.com/test/repo.git';
    process.env['GITHUB_TOKEN'] = 'ghp_test1234567890';
    process.env['LOG_LEVEL'] = 'error'; // Suppress logs in tests
    process.env['LOG_TO_FILE'] = 'false'; // Disable file logging in tests

    config = new ConfigAdapter();
    logger = new Logger(config);

    // Create mock git instance
    mockGit = {
      clone: jest.fn(),
      fetch: jest.fn(),
      revparse: jest.fn(),
      status: jest.fn(),
      pull: jest.fn(),
      log: jest.fn(),
      diff: jest.fn(),
      raw: jest.fn(),
    } as unknown as jest.Mocked<SimpleGit>;

    (simpleGit as jest.MockedFunction<typeof simpleGit>).mockReturnValue(
      mockGit
    );

    gitAdapter = new GitAdapter(config, logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeRepository', () => {
    it('should clone repository when directory does not exist', async () => {
      const token = 'ghp_test1234567890';
      const expectedUrl = `https://${token}@github.com/test/repo.git`;

      mockGit.clone.mockResolvedValue(undefined as never);

      const result = await gitAdapter.initializeRepository();

      expect(result.ok).toBe(true);
      expect(mockGit.clone).toHaveBeenCalledWith(
        expectedUrl,
        expect.any(String)
      );
    });

    it('should embed GitHub token in URL for private repositories', async () => {
      const token = 'ghp_test1234567890';
      mockGit.clone.mockResolvedValue(undefined as never);

      await gitAdapter.initializeRepository();

      expect(mockGit.clone).toHaveBeenCalledWith(
        expect.stringContaining(`https://${token}@github.com`),
        expect.any(String)
      );
    });

    it('should NOT log GitHub token in plain text', async () => {
      const logSpy = jest.spyOn(logger, 'info');
      mockGit.clone.mockResolvedValue(undefined as never);

      await gitAdapter.initializeRepository();

      // Check all log calls
      for (const call of logSpy.mock.calls) {
        const logMessage = call[0];
        expect(logMessage).not.toContain('ghp_test1234567890');
      }
    });

    it('should mask token in error messages', async () => {
      const errorMessage = 'Clone failed: https://ghp_secret1234567890@github.com/test/repo.git';
      mockGit.clone.mockRejectedValue(new Error(errorMessage) as never);

      const result = await gitAdapter.initializeRepository();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).not.toContain('ghp_secret1234567890');
        expect(result.error.message).toContain('***');
      }
    });

    it('should return error when clone fails', async () => {
      mockGit.clone.mockRejectedValue(
        new Error('Network error') as never
      );

      const result = await gitAdapter.initializeRepository();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Network error');
      }
    });

    it('should handle repository URL without .git extension', async () => {
      process.env['GIT_REPOSITORY_URL'] = 'https://github.com/test/repo';
      const newConfig = new ConfigAdapter();
      const newGitAdapter = new GitAdapter(newConfig, logger);

      mockGit.clone.mockResolvedValue(undefined as never);

      const result = await newGitAdapter.initializeRepository();

      expect(result.ok).toBe(true);
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      mockGit.revparse.mockResolvedValue('main' as never);

      const result = await gitAdapter.getCurrentBranch();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('main');
      }
    });

    it('should return error when git operation fails', async () => {
      mockGit.revparse.mockRejectedValue(
        new Error('Not a git repository') as never
      );

      const result = await gitAdapter.getCurrentBranch();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Not a git repository');
      }
    });
  });

  describe('getStatus', () => {
    it('should return git status information', async () => {
      mockGit.status.mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
        files: [],
        isClean: () => true,
      } as never);

      const result = await gitAdapter.getStatus();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.branch).toBe('main');
        expect(result.value.tracking).toBe('origin/main');
        expect(result.value.clean).toBe(true);
        expect(result.value.modified).toEqual([]);
      }
    });

    it('should list modified files when repository is not clean', async () => {
      mockGit.status.mockResolvedValue({
        current: 'feature',
        tracking: 'origin/feature',
        files: [
          { path: 'src/file1.ts', working_dir: 'M' },
          { path: 'src/file2.ts', working_dir: 'M' },
        ],
        isClean: () => false,
      } as never);

      const result = await gitAdapter.getStatus();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.clean).toBe(false);
        expect(result.value.modified).toContain('src/file1.ts');
        expect(result.value.modified).toContain('src/file2.ts');
      }
    });

    it('should return error when status check fails', async () => {
      mockGit.status.mockRejectedValue(
        new Error('Git error') as never
      );

      const result = await gitAdapter.getStatus();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Git error');
      }
    });
  });

  describe('checkForUpdates', () => {
    it('should detect when local branch is behind remote', async () => {
      mockGit.fetch.mockResolvedValue(undefined as never);
      mockGit.revparse.mockResolvedValueOnce('main' as never); // current branch
      mockGit.revparse.mockResolvedValueOnce('abc123' as never); // local commit
      mockGit.revparse.mockResolvedValueOnce('def456' as never); // remote commit
      // Simulate 3 commits behind
      mockGit.raw.mockResolvedValueOnce('commit1\ncommit2\ncommit3\n'); // behind count
      mockGit.raw.mockResolvedValueOnce(''); // ahead count

      const result = await gitAdapter.checkForUpdates();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.hasUpdates).toBe(true);
        expect(result.value.behind).toBe(3);
      }
    });

    it('should detect when local branch is up to date', async () => {
      mockGit.fetch.mockResolvedValue(undefined as never);
      mockGit.revparse.mockResolvedValueOnce('main' as never); // current branch
      mockGit.revparse.mockResolvedValueOnce('abc123' as never); // local commit
      mockGit.revparse.mockResolvedValueOnce('abc123' as never); // remote commit (same)

      const result = await gitAdapter.checkForUpdates();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.hasUpdates).toBe(false);
        expect(result.value.behind).toBe(0);
      }
    });

    it('should detect when local branch is ahead of remote', async () => {
      mockGit.fetch.mockResolvedValue(undefined as never);
      mockGit.revparse.mockResolvedValueOnce('main' as never); // current branch
      mockGit.revparse.mockResolvedValueOnce('def456' as never); // local commit
      mockGit.revparse.mockResolvedValueOnce('abc123' as never); // remote commit
      mockGit.raw
        .mockResolvedValueOnce('') // behind count
        .mockResolvedValueOnce('commit1\ncommit2\n'); // ahead count

      const result = await gitAdapter.checkForUpdates();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.hasUpdates).toBe(false);
        expect(result.value.ahead).toBe(2);
        expect(result.value.behind).toBe(0);
      }
    });

    it('should return error when fetch fails', async () => {
      mockGit.fetch.mockRejectedValue(new Error('Network timeout') as never);

      const result = await gitAdapter.checkForUpdates();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Network timeout');
      }
    });
  });

  describe('pullChanges', () => {
    it('should pull changes and return summary when updates are available', async () => {
      const pullSummary = {
        files: ['src/file1.ts', 'src/file2.ts'],
        insertions: { 'src/file1.ts': 10, 'src/file2.ts': 5 },
        deletions: { 'src/file1.ts': 2, 'src/file2.ts': 1 },
        summary: {
          changes: 2,
          insertions: 15,
          deletions: 3,
        },
      };

      mockGit.raw
        .mockResolvedValueOnce('10') // commits before
        .mockResolvedValueOnce('12'); // commits after
      mockGit.pull.mockResolvedValue(pullSummary as never);

      const result = await gitAdapter.pullChanges();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.updated).toBe(true);
        expect(result.value.files).toContain('src/file1.ts');
        expect(result.value.files).toContain('src/file2.ts');
        expect(result.value.summary).toContain('2 commits');
        expect(result.value.summary).toContain('2 files');
      }
    });

    it('should handle case when no updates are available', async () => {
      const pullSummary = {
        files: [],
        insertions: {},
        deletions: {},
        summary: {
          changes: 0,
          insertions: 0,
          deletions: 0,
        },
      };

      mockGit.raw
        .mockResolvedValueOnce('10') // commits before
        .mockResolvedValueOnce('10'); // commits after (same)
      mockGit.pull.mockResolvedValue(pullSummary as never);

      const result = await gitAdapter.pullChanges();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.updated).toBe(false);
        expect(result.value.files).toEqual([]);
      }
    });

    it('should return error when merge conflict occurs', async () => {
      mockGit.raw.mockResolvedValueOnce('10'); // commits before
      mockGit.pull.mockRejectedValue(
        new Error('CONFLICT (content): Merge conflict in src/file.ts') as never
      );

      const result = await gitAdapter.pullChanges();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Merge conflict');
        expect(result.error.code).toBe('GIT_PULL_ERROR');
      }
    });

    it('should return error when network fails during pull', async () => {
      mockGit.raw.mockResolvedValueOnce('10'); // commits before
      mockGit.pull.mockRejectedValue(
        new Error('Could not resolve host') as never
      );

      const result = await gitAdapter.pullChanges();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Could not resolve host');
      }
    });
  });

  describe('token masking', () => {
    it('should mask GitHub token in logged URLs', () => {
      const url = 'https://ghp_1234567890abcdef@github.com/test/repo.git';
      const masked = logger.maskSensitiveData(url);

      expect(masked).not.toContain('ghp_1234567890abcdef');
      expect(masked).toContain('***');
    });

    it('should mask token in HTTPS URLs', () => {
      const url = 'https://user:ghp_secret@github.com/repo.git';
      const masked = logger.maskSensitiveData(url);

      expect(masked).not.toContain('ghp_secret');
      expect(masked).toContain('***');
    });
  });
});
