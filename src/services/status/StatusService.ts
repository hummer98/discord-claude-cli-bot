/**
 * StatusService
 * Collects and formats bot status information
 */

import { GitAdapter } from '../../adapters/git/GitAdapter';
import { ClaudeCliAdapter } from '../../adapters/claude/ClaudeCliAdapter';
import { Result, ok } from '../../types/Result';

export class StatusService {
  private gitAdapter: GitAdapter;
  private claudeAdapter: ClaudeCliAdapter;
  private startTime: Date;

  constructor(gitAdapter: GitAdapter, claudeAdapter: ClaudeCliAdapter, startTime?: Date) {
    this.gitAdapter = gitAdapter;
    this.claudeAdapter = claudeAdapter;
    this.startTime = startTime || new Date();
  }

  /**
   * Get comprehensive bot status information
   */
  async getStatusInfo(): Promise<Result<string, Error>> {
    // Fetch Git status (async)
    const gitStatusResult = await this.gitAdapter.getStatus();

    // Get Claude token usage (sync)
    const tokenUsage = this.claudeAdapter.getTokenUsage();

    // Calculate uptime
    const uptimeSeconds = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    const uptime = this.formatUptime(uptimeSeconds);

    // Format status information in Markdown
    let status = '# Bot Status\n\n';

    // Git information
    if (gitStatusResult.ok) {
      const gitStatus = gitStatusResult.value;
      status += '## Git Information\n';
      status += `**Branch:** ${gitStatus.branch}\n`;

      if (gitStatus.tracking) {
        status += `**Tracking:** ${gitStatus.tracking}\n`;
      }

      if (gitStatus.clean) {
        status += `**Status:** Clean\n`;
      } else {
        const fileCount = gitStatus.modified.length;
        status += `**Status:** Modified (${fileCount} file${fileCount !== 1 ? 's' : ''})\n`;

        if (gitStatus.modified.length > 0) {
          status += '\n**Modified Files:**\n';
          gitStatus.modified.forEach((file) => {
            status += `- ${file}\n`;
          });
        }
      }
      status += '\n';
    } else {
      status += `**Git:** Error: ${gitStatusResult.error.message}\n\n`;
    }

    // Claude API token usage
    status += '## Claude API Usage\n';
    if (tokenUsage.totalTokens > 0) {
      status += `**Input Tokens:** ${this.formatNumber(tokenUsage.inputTokens)}\n`;
      status += `**Output Tokens:** ${this.formatNumber(tokenUsage.outputTokens)}\n`;
      status += `**Total Tokens:** ${this.formatNumber(tokenUsage.totalTokens)}\n`;
    } else {
      status += `**Input Tokens:** ${tokenUsage.inputTokens}\n`;
      status += `**Output Tokens:** ${tokenUsage.outputTokens}\n`;
    }
    status += '\n';

    // Bot uptime
    status += '## Bot Uptime\n';
    status += `**Uptime:** ${uptime}\n`;

    return ok(status);
  }

  /**
   * Format uptime in human-readable format
   */
  private formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Format number with thousand separators
   */
  private formatNumber(num: number): string {
    return num.toLocaleString('en-US');
  }
}
