/**
 * Shared type definitions for the Claude slash commands system
 */

export interface ArgDefinition {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required?: boolean;
  default?: unknown;
}

export interface CommandConfig {
  name: string;
  description: string;
  args?: ArgDefinition[];
  selfInvokable?: boolean;
  triggers?: string[];
}

export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface Command {
  config: CommandConfig;
  execute: (args: Record<string, unknown>) => Promise<CommandResult>;
}

export interface RegisteredCommand {
  name: string;
  type: 'typescript' | 'python';
  path: string;
  config: CommandConfig;
}

export interface ExecutionContext {
  cwd: string;
  env: Record<string, string>;
  recentEdits?: string[];
  recentToolCalls?: string[];
}

export interface TriggerMatch {
  command: RegisteredCommand;
  pattern: string;
  matchedContent: string;
}
