/**
 * Command registry for auto-discovering and registering commands
 */

import { glob } from 'glob';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CommandConfig, RegisteredCommand, TriggerMatch } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

export class CommandRegistry {
  private commands: Map<string, RegisteredCommand> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.discoverTypeScriptCommands(),
      this.discoverPythonCommands(),
    ]);

    this.initialized = true;
  }

  private async discoverTypeScriptCommands(): Promise<void> {
    const pattern = join(PROJECT_ROOT, 'commands/ts/*/index.ts');
    const files = await glob(pattern);

    for (const file of files) {
      try {
        const module = await import(file);
        const config: CommandConfig = module.config;

        if (!config?.name) {
          console.warn(`Skipping ${file}: missing config.name`);
          continue;
        }

        this.commands.set(config.name, {
          name: config.name,
          type: 'typescript',
          path: file,
          config,
        });
      } catch (error) {
        console.error(`Failed to load TypeScript command from ${file}:`, error);
      }
    }
  }

  private async discoverPythonCommands(): Promise<void> {
    const pattern = join(PROJECT_ROOT, 'commands/py/*/__init__.py');
    const files = await glob(pattern);

    for (const file of files) {
      try {
        // Read the Python file and extract config using regex
        const content = await readFile(file, 'utf-8');
        const config = this.parsePythonConfig(content, file);

        if (!config?.name) {
          console.warn(`Skipping ${file}: missing config.name`);
          continue;
        }

        this.commands.set(config.name, {
          name: config.name,
          type: 'python',
          path: file,
          config,
        });
      } catch (error) {
        console.error(`Failed to load Python command from ${file}:`, error);
      }
    }
  }

  private parsePythonConfig(content: string, filePath: string): CommandConfig | null {
    // Extract config from Python file using regex patterns
    const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
    const descMatch = content.match(/description\s*=\s*["']([^"']+)["']/);
    const selfInvokableMatch = content.match(/self_invokable\s*=\s*(True|False)/);
    const triggersMatch = content.match(/triggers\s*=\s*\[([\s\S]*?)\]/);

    if (!nameMatch) return null;

    const config: CommandConfig = {
      name: nameMatch[1],
      description: descMatch?.[1] ?? '',
      selfInvokable: selfInvokableMatch?.[1] === 'True',
    };

    if (triggersMatch) {
      const triggersStr = triggersMatch[1];
      const triggers = triggersStr.match(/["']([^"']+)["']/g);
      if (triggers) {
        config.triggers = triggers.map(t => t.slice(1, -1));
      }
    }

    return config;
  }

  getCommand(name: string): RegisteredCommand | undefined {
    return this.commands.get(name);
  }

  getAllCommands(): RegisteredCommand[] {
    return Array.from(this.commands.values());
  }

  getSelfInvokableCommands(): RegisteredCommand[] {
    return this.getAllCommands().filter(cmd => cmd.config.selfInvokable);
  }

  findTriggerMatches(context: string): TriggerMatch[] {
    const matches: TriggerMatch[] = [];

    for (const command of this.getSelfInvokableCommands()) {
      if (!command.config.triggers) continue;

      for (const pattern of command.config.triggers) {
        try {
          const regex = new RegExp(pattern, 'i');
          const match = context.match(regex);
          if (match) {
            matches.push({
              command,
              pattern,
              matchedContent: match[0],
            });
          }
        } catch {
          // Invalid regex pattern, skip
        }
      }
    }

    return matches;
  }

  formatCommandList(): string {
    const commands = this.getAllCommands();
    if (commands.length === 0) {
      return 'No commands registered.';
    }

    const lines = ['Available Commands:', ''];

    const tsCommands = commands.filter(c => c.type === 'typescript');
    const pyCommands = commands.filter(c => c.type === 'python');

    if (tsCommands.length > 0) {
      lines.push('TypeScript Commands:');
      for (const cmd of tsCommands) {
        const selfInvoke = cmd.config.selfInvokable ? ' [auto]' : '';
        lines.push(`  /${cmd.name}${selfInvoke} - ${cmd.config.description}`);
      }
      lines.push('');
    }

    if (pyCommands.length > 0) {
      lines.push('Python Commands:');
      for (const cmd of pyCommands) {
        const selfInvoke = cmd.config.selfInvokable ? ' [auto]' : '';
        lines.push(`  /${cmd.name}${selfInvoke} - ${cmd.config.description}`);
      }
    }

    return lines.join('\n');
  }
}

// Singleton instance
export const registry = new CommandRegistry();
