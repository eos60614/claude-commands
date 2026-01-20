#!/usr/bin/env tsx
/**
 * CLI entry point for slash commands
 */

import { registry } from './registry.js';
import { CommandExecutor } from './executor.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  await registry.initialize();

  switch (command) {
    case 'list': {
      console.log(registry.formatCommandList());
      break;
    }

    case 'run': {
      const commandName = args[1];
      if (!commandName) {
        console.error('Usage: npm run run <command-name> [args...]');
        process.exit(1);
      }

      // Parse remaining args as key=value pairs
      const commandArgs: Record<string, unknown> = {};
      for (let i = 2; i < args.length; i++) {
        const [key, ...valueParts] = args[i].split('=');
        const value = valueParts.join('=');
        if (key && value !== undefined) {
          // Try to parse as JSON, otherwise use as string
          try {
            commandArgs[key] = JSON.parse(value);
          } catch {
            commandArgs[key] = value || true;
          }
        }
      }

      const executor = new CommandExecutor();
      const result = await executor.execute(commandName, commandArgs);

      if (result.success) {
        console.log(result.output);
      } else {
        console.error('Error:', result.error);
        if (result.output) {
          console.log('Output:', result.output);
        }
        process.exit(1);
      }
      break;
    }

    case 'prompt': {
      const commandName = args[1];
      if (!commandName) {
        console.error('Usage: npm run run prompt <command-name>');
        process.exit(1);
      }

      const executor = new CommandExecutor();
      const prompt = await executor.getPrompt(commandName);

      if (prompt) {
        console.log(prompt);
      } else {
        console.error(`No prompt found for command: ${commandName}`);
        process.exit(1);
      }
      break;
    }

    case 'triggers': {
      const recentEdits = args.slice(1);
      const executor = new CommandExecutor({
        recentEdits,
      });

      const suggestions = await executor.checkTriggers();

      if (suggestions.length > 0) {
        console.log('Suggested commands:');
        suggestions.forEach(s => console.log(`  - ${s}`));
      } else {
        console.log('No command suggestions based on current context.');
      }
      break;
    }

    default: {
      console.log(`
Claude Commands CLI

Usage:
  npm run list              List all available commands
  npm run run <name> [args] Execute a command
  npm run run prompt <name> Show command prompt/instructions
  npm run run triggers [...] Check for trigger matches

Examples:
  npm run list
  npm run run commit message="feat: add feature"
  npm run run prompt commit
  npm run run triggers "edited src/test.spec.ts"
`);
    }
  }
}

main().catch(console.error);
