/**
 * Command executor for running TypeScript and Python commands
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';
import type { CommandResult, RegisteredCommand, ExecutionContext } from './types.js';
import { registry } from './registry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

export class CommandExecutor {
  private context: ExecutionContext;

  constructor(context?: Partial<ExecutionContext>) {
    this.context = {
      cwd: context?.cwd ?? process.cwd(),
      env: context?.env ?? process.env as Record<string, string>,
      recentEdits: context?.recentEdits ?? [],
      recentToolCalls: context?.recentToolCalls ?? [],
    };
  }

  async execute(
    commandName: string,
    args: Record<string, unknown> = {}
  ): Promise<CommandResult> {
    await registry.initialize();

    const command = registry.getCommand(commandName);
    if (!command) {
      return {
        success: false,
        output: '',
        error: `Command not found: ${commandName}`,
      };
    }

    try {
      if (command.type === 'typescript') {
        return await this.executeTypeScript(command, args);
      } else {
        return await this.executePython(command, args);
      }
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async executeTypeScript(
    command: RegisteredCommand,
    args: Record<string, unknown>
  ): Promise<CommandResult> {
    // Dynamically import and execute the TypeScript command
    const module = await import(command.path);

    if (typeof module.execute !== 'function') {
      return {
        success: false,
        output: '',
        error: `Command ${command.name} does not export an execute function`,
      };
    }

    return await module.execute(args, this.context);
  }

  private async executePython(
    command: RegisteredCommand,
    args: Record<string, unknown>
  ): Promise<CommandResult> {
    const commandDir = dirname(command.path);

    // Create a Python runner script inline
    const argsJson = JSON.stringify(args);
    const contextJson = JSON.stringify(this.context);

    const pythonCode = `
import sys
import json
import asyncio
sys.path.insert(0, '${commandDir}')

from __init__ import execute

args = json.loads('${argsJson.replace(/'/g, "\\'")}')
context = json.loads('${contextJson.replace(/'/g, "\\'")}')

async def main():
    result = await execute(args, context)
    print(json.dumps({
        'success': result.success,
        'output': result.output,
        'error': result.error
    }))

asyncio.run(main())
`;

    return new Promise((resolve) => {
      const proc = spawn('python3', ['-c', pythonCode], {
        cwd: this.context.cwd,
        env: this.context.env,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          resolve({
            success: false,
            output: stdout,
            error: stderr || `Process exited with code ${code}`,
          });
          return;
        }

        try {
          // Find the last JSON line in output
          const lines = stdout.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const result = JSON.parse(lastLine);
          resolve(result);
        } catch {
          resolve({
            success: true,
            output: stdout,
          });
        }
      });

      proc.on('error', (error) => {
        resolve({
          success: false,
          output: '',
          error: error.message,
        });
      });
    });
  }

  async getPrompt(commandName: string): Promise<string | null> {
    await registry.initialize();

    const command = registry.getCommand(commandName);
    if (!command) return null;

    const promptPath = join(dirname(command.path), 'prompt.md');

    try {
      return await readFile(promptPath, 'utf-8');
    } catch {
      return null;
    }
  }

  async checkTriggers(): Promise<string[]> {
    const suggestions: string[] = [];
    const contextStr = [
      ...this.context.recentEdits ?? [],
      ...this.context.recentToolCalls ?? [],
    ].join('\n');

    const matches = registry.findTriggerMatches(contextStr);

    for (const match of matches) {
      suggestions.push(
        `Consider running /${match.command.name}: matched "${match.pattern}" on "${match.matchedContent}"`
      );
    }

    return suggestions;
  }
}

export const executor = new CommandExecutor();
