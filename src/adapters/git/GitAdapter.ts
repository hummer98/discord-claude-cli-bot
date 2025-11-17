/**
 * GitAdapter
 * Manages Git repository operations and synchronization
 */

import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import { ConfigAdapter, ConfigKey } from '../config/ConfigAdapter';
import { Logger } from '../../services/logger/Logger';
import { Result, ok, err } from '../../types/Result';
import * as fs from 'fs';
import * as path from 'path';

export interface GitStatus {
  branch: string;
  clean: boolean;
  modified: string[];
  tracking?: string;
}

export interface GitUpdateInfo {
  hasUpdates: boolean;
  behind: number;
  ahead: number;
}

export interface GitPullResult {
  updated: boolean;
  summary: string;
  files: string[];
}

export interface GitError {
  message: string;
  code?: string;
}

export class GitAdapter {
  private git: SimpleGit;
  private config: ConfigAdapter;
  private logger: Logger;
  private repoPath: string;

  constructor(config: ConfigAdapter, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.repoPath = path.join(process.cwd(), 'repo');
    this.git = simpleGit();
  }

  /**
   * Initialize Git repository (clone or use existing)
   */
  async initializeRepository(): Promise<Result<void, GitError>> {
    try {
      const repoUrl = this.config.get(ConfigKey.GIT_REPOSITORY_URL);
      const token = this.config.getOptional(ConfigKey.GITHUB_TOKEN, '');

      // Build authenticated URL if token is provided
      const authenticatedUrl = this.buildAuthenticatedUrl(repoUrl, token);

      // Log with masked URL
      const maskedUrl = this.logger.maskSensitiveData(authenticatedUrl);
      this.logger.info('Initializing Git repository', {
        repository: maskedUrl,
        path: this.repoPath,
      });

      // Check if repository already exists
      if (fs.existsSync(path.join(this.repoPath, '.git'))) {
        this.logger.info('Repository already exists, skipping clone');
        this.git = simpleGit(this.repoPath);
        return ok(undefined);
      }

      // Clone repository
      await this.git.clone(authenticatedUrl, this.repoPath);
      this.git = simpleGit(this.repoPath);

      this.logger.info('Repository cloned successfully');
      return ok(undefined);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const maskedMessage = this.logger.maskSensitiveData(errorMessage);

      this.logger.error('Failed to initialize repository', error as Error);

      return err({
        message: maskedMessage,
        code: 'GIT_INIT_ERROR',
      });
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<Result<string, GitError>> {
    try {
      const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
      return ok(branch.trim());
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Failed to get current branch', error as Error);

      return err({
        message: errorMessage,
        code: 'GIT_BRANCH_ERROR',
      });
    }
  }

  /**
   * Get repository status
   */
  async getStatus(): Promise<Result<GitStatus, GitError>> {
    try {
      const status: StatusResult = await this.git.status();

      const gitStatus: GitStatus = {
        branch: status.current || 'unknown',
        clean: status.isClean(),
        modified: status.files.map((file) => file.path),
        ...(status.tracking ? { tracking: status.tracking } : {}),
      };

      return ok(gitStatus);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Failed to get git status', error as Error);

      return err({
        message: errorMessage,
        code: 'GIT_STATUS_ERROR',
      });
    }
  }

  /**
   * Check for updates from remote tracking branch
   */
  async checkForUpdates(): Promise<Result<GitUpdateInfo, GitError>> {
    try {
      this.logger.info('Checking for Git updates');

      // Fetch latest changes from remote
      await this.git.fetch();

      // Get current branch
      const currentBranch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
      const trackingBranch = `origin/${currentBranch.trim()}`;

      // Get local and remote commit hashes
      const localCommit = await this.git.revparse(['HEAD']);
      const remoteCommit = await this.git.revparse([trackingBranch]);

      // Check if commits are the same
      if (localCommit.trim() === remoteCommit.trim()) {
        this.logger.info('Local branch is up to date');
        return ok({
          hasUpdates: false,
          behind: 0,
          ahead: 0,
        });
      }

      // Count commits behind (remote commits not in local)
      const behindOutput = await this.git.raw([
        'rev-list',
        '--count',
        `HEAD..${trackingBranch}`,
      ]);
      const behind = behindOutput.trim() ? behindOutput.trim().split('\n').length : 0;

      // Count commits ahead (local commits not in remote)
      const aheadOutput = await this.git.raw([
        'rev-list',
        '--count',
        `${trackingBranch}..HEAD`,
      ]);
      const ahead = aheadOutput.trim() ? aheadOutput.trim().split('\n').length : 0;

      const hasUpdates = behind > 0;

      this.logger.info('Git update check complete', {
        behind,
        ahead,
        hasUpdates,
      });

      return ok({
        hasUpdates,
        behind,
        ahead,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Failed to check for updates', error as Error);

      return err({
        message: errorMessage,
        code: 'GIT_CHECK_ERROR',
      });
    }
  }

  /**
   * Pull changes from remote repository
   */
  async pullChanges(): Promise<Result<GitPullResult, GitError>> {
    try {
      this.logger.info('Pulling Git changes');

      // Get commit count before pull
      const beforePull = await this.git.raw(['rev-list', '--count', 'HEAD']);
      const commitsBefore = parseInt(beforePull.trim(), 10);

      // Pull changes
      const pullSummary = await this.git.pull();

      // Get commit count after pull
      const afterPull = await this.git.raw(['rev-list', '--count', 'HEAD']);
      const commitsAfter = parseInt(afterPull.trim(), 10);
      const newCommits = commitsAfter - commitsBefore;

      const files = pullSummary.files || [];
      const fileCount = files.length;

      const updated = fileCount > 0 || newCommits > 0;

      let summary = '';
      if (updated) {
        summary = `Updated: ${newCommits} commits, ${fileCount} files changed`;
      } else {
        summary = 'Already up to date';
      }

      this.logger.info('Git pull complete', {
        updated,
        commits: newCommits,
        files: fileCount,
      });

      return ok({
        updated,
        summary,
        files,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Failed to pull changes', error as Error);

      return err({
        message: errorMessage,
        code: 'GIT_PULL_ERROR',
      });
    }
  }

  /**
   * Build authenticated URL with GitHub token
   * @private
   */
  private buildAuthenticatedUrl(repoUrl: string, token: string): string {
    if (!token) {
      return repoUrl;
    }

    // Parse URL and inject token
    // https://github.com/user/repo.git -> https://TOKEN@github.com/user/repo.git
    const urlPattern = /^https:\/\/github\.com\//;
    if (urlPattern.test(repoUrl)) {
      return repoUrl.replace(
        'https://github.com/',
        `https://${token}@github.com/`
      );
    }

    return repoUrl;
  }
}
