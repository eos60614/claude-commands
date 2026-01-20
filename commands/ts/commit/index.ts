/**
 * /commit - Smart git commit with conventional commits support
 */

import { execSync } from 'child_process';
import type { CommandConfig, CommandResult, ExecutionContext } from '../../../src/types.js';

export const config: CommandConfig = {
  name: 'commit',
  description: 'Create a smart git commit with conventional commit format',
  args: [
    {
      name: 'message',
      description: 'Optional commit message (auto-generated if not provided)',
      type: 'string',
      required: false,
    },
    {
      name: 'type',
      description: 'Commit type (feat, fix, docs, style, refactor, test, chore)',
      type: 'string',
      required: false,
      default: 'feat',
    },
    {
      name: 'scope',
      description: 'Optional scope for the commit',
      type: 'string',
      required: false,
    },
    {
      name: 'all',
      description: 'Stage all changes before committing',
      type: 'boolean',
      required: false,
      default: false,
    },
  ],
  selfInvokable: true,
  triggers: [
    'completed.*feature',
    'finished.*implementation',
    'ready.*commit',
  ],
};

function exec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (error: unknown) {
    const execError = error as { stderr?: Buffer | string };
    if (execError.stderr) {
      throw new Error(String(execError.stderr));
    }
    throw error;
  }
}

function getGitStatus(cwd: string): { staged: string[]; unstaged: string[]; untracked: string[] } {
  const status = exec('git status --porcelain', cwd);
  const lines = status.split('\n').filter(Boolean);

  const staged: string[] = [];
  const unstaged: string[] = [];
  const untracked: string[] = [];

  for (const line of lines) {
    const indexStatus = line[0];
    const workTreeStatus = line[1];
    const file = line.slice(3);

    if (indexStatus === '?') {
      untracked.push(file);
    } else if (indexStatus !== ' ') {
      staged.push(file);
    }
    if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
      unstaged.push(file);
    }
  }

  return { staged, unstaged, untracked };
}

function getStagedDiff(cwd: string): string {
  try {
    return exec('git diff --cached --stat', cwd);
  } catch {
    return '';
  }
}

function getRecentCommits(cwd: string, count = 5): string[] {
  try {
    const log = exec(`git log --oneline -${count}`, cwd);
    return log.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function inferCommitType(files: string[]): string {
  const patterns: [RegExp, string][] = [
    [/test|spec/i, 'test'],
    [/\.md$|readme|doc/i, 'docs'],
    [/\.css$|\.scss$|style/i, 'style'],
    [/fix|bug|patch/i, 'fix'],
    [/refactor/i, 'refactor'],
    [/config|\.json$|\.yaml$|\.yml$/i, 'chore'],
  ];

  for (const file of files) {
    for (const [pattern, type] of patterns) {
      if (pattern.test(file)) {
        return type;
      }
    }
  }

  return 'feat';
}

function generateCommitMessage(
  type: string,
  scope: string | undefined,
  diff: string,
  files: string[]
): string {
  const scopePart = scope ? `(${scope})` : '';

  // Simple heuristic-based message generation
  if (files.length === 1) {
    const file = files[0];
    const fileName = file.split('/').pop()?.replace(/\.[^.]+$/, '') ?? file;
    return `${type}${scopePart}: update ${fileName}`;
  }

  if (files.every(f => f.includes('test') || f.includes('spec'))) {
    return `${type}${scopePart}: update tests`;
  }

  const dirs = [...new Set(files.map(f => f.split('/')[0]))];
  if (dirs.length === 1) {
    return `${type}${scopePart}: update ${dirs[0]}`;
  }

  return `${type}${scopePart}: update ${files.length} files`;
}

export async function execute(
  args: Record<string, unknown>,
  context?: ExecutionContext
): Promise<CommandResult> {
  const cwd = context?.cwd ?? process.cwd();

  try {
    // Check if we're in a git repo
    exec('git rev-parse --git-dir', cwd);
  } catch {
    return {
      success: false,
      output: '',
      error: 'Not a git repository',
    };
  }

  try {
    const stageAll = args.all === true;

    if (stageAll) {
      exec('git add -A', cwd);
    }

    const status = getGitStatus(cwd);

    if (status.staged.length === 0) {
      if (status.unstaged.length === 0 && status.untracked.length === 0) {
        return {
          success: false,
          output: '',
          error: 'Nothing to commit, working tree clean',
        };
      }
      return {
        success: false,
        output: `Unstaged: ${status.unstaged.length}, Untracked: ${status.untracked.length}`,
        error: 'No staged changes. Use --all flag or stage changes manually.',
      };
    }

    const diff = getStagedDiff(cwd);
    const recentCommits = getRecentCommits(cwd);

    let commitType = (args.type as string) ?? inferCommitType(status.staged);
    let scope = args.scope as string | undefined;
    let message = args.message as string | undefined;

    if (!message) {
      message = generateCommitMessage(commitType, scope, diff, status.staged);
    } else {
      // If message provided but no type prefix, add it
      if (!message.match(/^(feat|fix|docs|style|refactor|test|chore)/)) {
        const scopePart = scope ? `(${scope})` : '';
        message = `${commitType}${scopePart}: ${message}`;
      }
    }

    // Create the commit
    const escapedMessage = message.replace(/"/g, '\\"');
    exec(`git commit -m "${escapedMessage}"`, cwd);

    const output = [
      `✓ Committed: ${message}`,
      '',
      'Staged files:',
      ...status.staged.map(f => `  - ${f}`),
      '',
      'Diff summary:',
      diff,
    ].join('\n');

    return {
      success: true,
      output,
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
