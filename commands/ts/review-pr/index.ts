/**
 * /review-pr - PR review with checklist
 */

import { execSync } from 'child_process';
import type { CommandConfig, CommandResult, ExecutionContext } from '../../../src/types.js';

export const config: CommandConfig = {
  name: 'review-pr',
  description: 'Review a pull request with automated checklist',
  args: [
    {
      name: 'pr',
      description: 'PR number or URL',
      type: 'string',
      required: false,
    },
    {
      name: 'base',
      description: 'Base branch to compare against',
      type: 'string',
      required: false,
      default: 'main',
    },
  ],
  selfInvokable: true,
  triggers: [
    'review.*pr',
    'check.*pull.*request',
    'pr.*review',
  ],
};

function exec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (error: unknown) {
    const execError = error as { stdout?: Buffer | string; stderr?: Buffer | string };
    // Return stdout even on error for gh commands
    if (execError.stdout) {
      return String(execError.stdout).trim();
    }
    throw error;
  }
}

interface FileChange {
  file: string;
  additions: number;
  deletions: number;
  status: string;
}

function getDiff(cwd: string, base: string): string {
  try {
    return exec(`git diff ${base}...HEAD`, cwd);
  } catch {
    return exec(`git diff ${base}`, cwd);
  }
}

function getChangedFiles(cwd: string, base: string): FileChange[] {
  try {
    const output = exec(`git diff --numstat ${base}...HEAD`, cwd);
    return output.split('\n').filter(Boolean).map(line => {
      const [add, del, file] = line.split('\t');
      return {
        file,
        additions: parseInt(add) || 0,
        deletions: parseInt(del) || 0,
        status: 'modified',
      };
    });
  } catch {
    return [];
  }
}

function checkForSecurityIssues(diff: string): string[] {
  const issues: string[] = [];
  const patterns: [RegExp, string][] = [
    [/password\s*=\s*["'][^"']+["']/gi, 'Hardcoded password detected'],
    [/api[_-]?key\s*=\s*["'][^"']+["']/gi, 'Hardcoded API key detected'],
    [/secret\s*=\s*["'][^"']+["']/gi, 'Hardcoded secret detected'],
    [/eval\s*\(/g, 'eval() usage detected - potential security risk'],
    [/dangerouslySetInnerHTML/g, 'dangerouslySetInnerHTML usage - XSS risk'],
    [/innerHTML\s*=/g, 'innerHTML assignment - potential XSS risk'],
    [/\$\{.*\}/g, 'Template literal in sensitive context - check for injection'],
  ];

  for (const [pattern, message] of patterns) {
    if (pattern.test(diff)) {
      issues.push(`⚠️  ${message}`);
    }
  }

  return issues;
}

function checkForCodeQuality(diff: string): string[] {
  const issues: string[] = [];
  const patterns: [RegExp, string][] = [
    [/console\.log\(/g, 'console.log() statements found'],
    [/debugger;/g, 'debugger statement found'],
    [/TODO:|FIXME:|HACK:/gi, 'TODO/FIXME/HACK comments found'],
    [/any(?:\s|;|,|\))/g, 'TypeScript `any` type usage found'],
    [/@ts-ignore/g, '@ts-ignore directive found'],
    [/eslint-disable/g, 'ESLint disable directive found'],
  ];

  for (const [pattern, message] of patterns) {
    if (pattern.test(diff)) {
      issues.push(`📝 ${message}`);
    }
  }

  return issues;
}

function generateChecklist(files: FileChange[], diff: string): string[] {
  const checklist: string[] = [];

  // Basic checks
  checklist.push('- [ ] Code compiles without errors');
  checklist.push('- [ ] All tests pass');
  checklist.push('- [ ] No linting errors');

  // Check for test files
  const hasTestChanges = files.some(f =>
    f.file.includes('test') || f.file.includes('spec')
  );
  if (!hasTestChanges && files.some(f => f.file.endsWith('.ts') || f.file.endsWith('.js'))) {
    checklist.push('- [ ] Tests added/updated for new code');
  }

  // Check for documentation
  const hasDocChanges = files.some(f =>
    f.file.endsWith('.md') || f.file.includes('doc')
  );
  if (!hasDocChanges) {
    checklist.push('- [ ] Documentation updated if needed');
  }

  // Check for migrations
  const hasMigrations = files.some(f => f.file.includes('migration'));
  if (hasMigrations) {
    checklist.push('- [ ] Database migrations reviewed');
    checklist.push('- [ ] Migrations are reversible');
  }

  // Check for dependency changes
  const hasDependencyChanges = files.some(f =>
    f.file === 'package.json' || f.file === 'package-lock.json' ||
    f.file === 'yarn.lock' || f.file === 'pnpm-lock.yaml'
  );
  if (hasDependencyChanges) {
    checklist.push('- [ ] New dependencies reviewed for security');
    checklist.push('- [ ] Lock file updated');
  }

  // Check for config changes
  const hasConfigChanges = files.some(f =>
    f.file.includes('config') || f.file.endsWith('.env.example')
  );
  if (hasConfigChanges) {
    checklist.push('- [ ] Configuration changes documented');
    checklist.push('- [ ] Environment variables updated');
  }

  return checklist;
}

export async function execute(
  args: Record<string, unknown>,
  context?: ExecutionContext
): Promise<CommandResult> {
  const cwd = context?.cwd ?? process.cwd();
  const base = (args.base as string) ?? 'main';

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
    const files = getChangedFiles(cwd, base);
    const diff = getDiff(cwd, base);

    if (files.length === 0) {
      return {
        success: false,
        output: '',
        error: `No changes found compared to ${base}`,
      };
    }

    const securityIssues = checkForSecurityIssues(diff);
    const qualityIssues = checkForCodeQuality(diff);
    const checklist = generateChecklist(files, diff);

    const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
    const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

    const output: string[] = [
      '# PR Review Summary',
      '',
      `**Base Branch:** ${base}`,
      `**Files Changed:** ${files.length}`,
      `**Lines:** +${totalAdditions} / -${totalDeletions}`,
      '',
      '## Changed Files',
      '',
      ...files.map(f => `- \`${f.file}\` (+${f.additions}/-${f.deletions})`),
      '',
    ];

    if (securityIssues.length > 0) {
      output.push('## ⚠️ Security Concerns', '', ...securityIssues, '');
    }

    if (qualityIssues.length > 0) {
      output.push('## 📝 Code Quality Notes', '', ...qualityIssues, '');
    }

    output.push('## Review Checklist', '', ...checklist, '');

    return {
      success: true,
      output: output.join('\n'),
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
