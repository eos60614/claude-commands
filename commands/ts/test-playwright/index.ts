/**
 * /test-playwright - Run Playwright tests without swallowing errors
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import type { CommandConfig, CommandResult, ExecutionContext } from '../../../src/types.js';

export const config: CommandConfig = {
  name: 'test-playwright',
  description: 'Run Playwright tests with full error output',
  args: [
    {
      name: 'file',
      description: 'Specific test file or pattern to run',
      type: 'string',
      required: false,
    },
    {
      name: 'headed',
      description: 'Run tests in headed mode',
      type: 'boolean',
      required: false,
      default: false,
    },
    {
      name: 'debug',
      description: 'Run tests in debug mode',
      type: 'boolean',
      required: false,
      default: false,
    },
    {
      name: 'project',
      description: 'Run tests for specific project (chromium, firefox, webkit)',
      type: 'string',
      required: false,
    },
    {
      name: 'grep',
      description: 'Run tests matching this regex pattern',
      type: 'string',
      required: false,
    },
    {
      name: 'retries',
      description: 'Number of retries for failed tests',
      type: 'number',
      required: false,
      default: 0,
    },
  ],
  selfInvokable: true,
  triggers: [
    'edited.*\\.spec\\.ts',
    'edited.*\\.test\\.ts',
    'edited.*e2e.*',
    'edited.*playwright.*',
    'run.*test',
    'test.*playwright',
  ],
};

function findPlaywrightConfig(cwd: string): string | null {
  const configNames = [
    'playwright.config.ts',
    'playwright.config.js',
    'playwright.config.mjs',
  ];

  for (const name of configNames) {
    if (existsSync(join(cwd, name))) {
      return name;
    }
  }

  return null;
}

function detectPackageManager(cwd: string): 'npm' | 'yarn' | 'pnpm' | 'bun' {
  if (existsSync(join(cwd, 'bun.lockb'))) return 'bun';
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

export async function execute(
  args: Record<string, unknown>,
  context?: ExecutionContext
): Promise<CommandResult> {
  const cwd = context?.cwd ?? process.cwd();

  // Check for Playwright config
  const configFile = findPlaywrightConfig(cwd);
  if (!configFile) {
    return {
      success: false,
      output: '',
      error: 'No Playwright config found. Expected playwright.config.ts or playwright.config.js',
    };
  }

  const pm = detectPackageManager(cwd);
  const runCmd = pm === 'npm' ? 'npx' : pm;

  // Build command arguments
  const cmdArgs = ['playwright', 'test'];

  if (args.file) {
    cmdArgs.push(String(args.file));
  }

  if (args.headed === true) {
    cmdArgs.push('--headed');
  }

  if (args.debug === true) {
    cmdArgs.push('--debug');
  }

  if (args.project) {
    cmdArgs.push('--project', String(args.project));
  }

  if (args.grep) {
    cmdArgs.push('--grep', String(args.grep));
  }

  if (args.retries !== undefined && args.retries !== 0) {
    cmdArgs.push('--retries', String(args.retries));
  }

  // Always show full output
  cmdArgs.push('--reporter=list');

  return new Promise((resolve) => {
    const proc = spawn(runCmd, cmdArgs, {
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
      const success = code === 0;

      // Parse test results from output
      const passedMatch = stdout.match(/(\d+) passed/);
      const failedMatch = stdout.match(/(\d+) failed/);
      const skippedMatch = stdout.match(/(\d+) skipped/);

      const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
      const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
      const skipped = skippedMatch ? parseInt(skippedMatch[1]) : 0;

      const summary = [
        '',
        '─'.repeat(50),
        `Test Results: ${success ? '✅ PASSED' : '❌ FAILED'}`,
        `  Passed: ${passed}`,
        `  Failed: ${failed}`,
        `  Skipped: ${skipped}`,
        '─'.repeat(50),
      ].join('\n');

      if (!success) {
        // Extract error details for failed tests
        const errorSection = stderr || stdout.split('─'.repeat(50)).pop() || '';

        resolve({
          success: false,
          output: stdout + summary,
          error: `${failed} test(s) failed.\n\n${errorSection}`,
        });
      } else {
        resolve({
          success: true,
          output: stdout + summary,
        });
      }
    });

    proc.on('error', (error) => {
      resolve({
        success: false,
        output: stdout,
        error: `Failed to run Playwright: ${error.message}`,
      });
    });
  });
}
