/**
 * /lint-fix - Run linter and auto-fix issues
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import type { CommandConfig, CommandResult, ExecutionContext } from '../../../src/types.js';

export const config: CommandConfig = {
  name: 'lint-fix',
  description: 'Run linter and auto-fix issues',
  args: [
    {
      name: 'path',
      description: 'Path to lint (default: .)',
      type: 'string',
      required: false,
      default: '.',
    },
    {
      name: 'fix',
      description: 'Auto-fix issues',
      type: 'boolean',
      required: false,
      default: true,
    },
    {
      name: 'format',
      description: 'Also run formatter (prettier)',
      type: 'boolean',
      required: false,
      default: false,
    },
  ],
  selfInvokable: true,
  triggers: [
    'lint.*error',
    'fix.*lint',
    'eslint.*error',
    'formatting.*issue',
  ],
};

type LinterType = 'eslint' | 'biome' | 'ruff' | 'none';

function detectLinter(cwd: string): LinterType {
  // Check for Biome
  if (existsSync(join(cwd, 'biome.json')) || existsSync(join(cwd, 'biome.jsonc'))) {
    return 'biome';
  }

  // Check for ESLint
  const eslintConfigs = [
    '.eslintrc',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.json',
    '.eslintrc.yaml',
    '.eslintrc.yml',
    'eslint.config.js',
    'eslint.config.mjs',
    'eslint.config.cjs',
  ];
  for (const config of eslintConfigs) {
    if (existsSync(join(cwd, config))) {
      return 'eslint';
    }
  }

  // Check for Ruff (Python)
  if (existsSync(join(cwd, 'ruff.toml')) || existsSync(join(cwd, '.ruff.toml'))) {
    return 'ruff';
  }

  // Check pyproject.toml for ruff config
  if (existsSync(join(cwd, 'pyproject.toml'))) {
    return 'ruff';
  }

  return 'none';
}

function detectPackageManager(cwd: string): 'npm' | 'yarn' | 'pnpm' | 'bun' {
  if (existsSync(join(cwd, 'bun.lockb'))) return 'bun';
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

function runCommand(
  cmd: string,
  args: string[],
  cwd: string
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd,
      env: { ...process.env, FORCE_COLOR: '1' },
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    proc.stderr?.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    proc.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });

    proc.on('error', (error) => {
      resolve({ code: 1, stdout, stderr: error.message });
    });
  });
}

export async function execute(
  args: Record<string, unknown>,
  context?: ExecutionContext
): Promise<CommandResult> {
  const cwd = context?.cwd ?? process.cwd();
  const targetPath = (args.path as string) ?? '.';
  const autoFix = args.fix !== false;
  const runFormat = args.format === true;

  const linter = detectLinter(cwd);

  if (linter === 'none') {
    return {
      success: false,
      output: '',
      error: 'No linter configuration found. Supported: ESLint, Biome, Ruff',
    };
  }

  const results: string[] = [];
  let hasErrors = false;

  // Run linter
  if (linter === 'eslint') {
    const pm = detectPackageManager(cwd);
    const runCmd = pm === 'npm' ? 'npx' : pm;
    const eslintArgs = ['eslint', targetPath];

    if (autoFix) {
      eslintArgs.push('--fix');
    }

    results.push('Running ESLint...');
    const result = await runCommand(runCmd, eslintArgs, cwd);
    results.push(result.stdout);

    if (result.code !== 0) {
      hasErrors = true;
      if (result.stderr) {
        results.push(result.stderr);
      }
    }
  } else if (linter === 'biome') {
    const pm = detectPackageManager(cwd);
    const runCmd = pm === 'npm' ? 'npx' : pm;
    const biomeCmd = autoFix ? 'check' : 'lint';
    const biomeArgs = ['biome', biomeCmd, targetPath];

    if (autoFix) {
      biomeArgs.push('--write');
    }

    results.push('Running Biome...');
    const result = await runCommand(runCmd, biomeArgs, cwd);
    results.push(result.stdout);

    if (result.code !== 0) {
      hasErrors = true;
      if (result.stderr) {
        results.push(result.stderr);
      }
    }
  } else if (linter === 'ruff') {
    const ruffArgs = ['check', targetPath];

    if (autoFix) {
      ruffArgs.push('--fix');
    }

    results.push('Running Ruff...');
    const result = await runCommand('ruff', ruffArgs, cwd);
    results.push(result.stdout);

    if (result.code !== 0) {
      hasErrors = true;
      if (result.stderr) {
        results.push(result.stderr);
      }
    }
  }

  // Optionally run formatter
  if (runFormat) {
    const pm = detectPackageManager(cwd);
    const runCmd = pm === 'npm' ? 'npx' : pm;

    if (linter === 'biome') {
      results.push('\nRunning Biome formatter...');
      const formatArgs = ['biome', 'format', targetPath];
      if (autoFix) {
        formatArgs.push('--write');
      }
      const result = await runCommand(runCmd, formatArgs, cwd);
      results.push(result.stdout);
    } else if (existsSync(join(cwd, '.prettierrc')) ||
               existsSync(join(cwd, 'prettier.config.js')) ||
               existsSync(join(cwd, '.prettierrc.json'))) {
      results.push('\nRunning Prettier...');
      const prettierArgs = ['prettier', targetPath];
      if (autoFix) {
        prettierArgs.push('--write');
      } else {
        prettierArgs.push('--check');
      }
      const result = await runCommand(runCmd, prettierArgs, cwd);
      results.push(result.stdout);
      if (result.code !== 0) {
        hasErrors = true;
      }
    } else if (linter === 'ruff') {
      results.push('\nRunning Ruff formatter...');
      const formatArgs = ['format', targetPath];
      const result = await runCommand('ruff', formatArgs, cwd);
      results.push(result.stdout);
    }
  }

  const output = results.join('\n');

  if (hasErrors) {
    return {
      success: false,
      output,
      error: 'Linting completed with errors. See output above.',
    };
  }

  return {
    success: true,
    output: output + '\n\n✅ Linting completed successfully.',
  };
}
