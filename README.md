# Claude Commands

A modular slash commands system for Claude Code with TypeScript and Python support.

## Features

- **Multi-language**: Write commands in TypeScript or Python
- **Auto-discovery**: Commands are automatically discovered from the `commands/` directory
- **Self-invocation**: Commands can suggest themselves based on context triggers
- **Unified interface**: Same command interface regardless of implementation language
- **Claude Code integration**: Works with hooks and settings

## Quick Start

```bash
# Install dependencies
npm install

# List available commands
npm run list

# Run a command
npm run run commit message="feat: initial commit"
```

## Available Commands

### TypeScript Commands

- `/commit` - Smart git commit with conventional commit format
- `/review-pr` - PR review with automated checklist and security scanning
- `/test-playwright` - Run Playwright tests with full error output
- `/lint-fix` - Run linter and auto-fix issues (ESLint, Biome, Ruff)
- `/gen-docs` - Generate API documentation from source code

### Python Commands

- `/analyze-errors` - Parse and explain error logs with suggestions
- `/db-migrate` - PostgreSQL migration helper
- `/ml-predict` - Run ML model inference (sklearn, torch, onnx)

## Installation

### TypeScript/Node.js

```bash
npm install
```

### Python (optional, for Python commands)

```bash
# Using uv (recommended)
uv sync

# Or using pip
pip install -e .
```

## Usage

### CLI

```bash
# List all commands
npm run list

# Run a command with arguments
npm run run <command-name> [args...]

# Examples
npm run run commit message="fix: resolve bug"
npm run run test-playwright file=tests/auth.spec.ts
npm run run lint-fix path=src format=true
npm run run analyze-errors log="ModuleNotFoundError: No module named 'foo'"
```

### With Claude Code

Commands integrate with Claude Code through:

1. **Direct invocation**: Mention `/command-name` in conversation
2. **Self-invocation**: Commands suggest themselves based on triggers
3. **Hooks**: Post-tool hooks can suggest relevant commands

## Creating Commands

### TypeScript Command

Create `commands/ts/<name>/index.ts`:

```typescript
import type { CommandConfig, CommandResult } from '../../../src/types.js';

export const config: CommandConfig = {
  name: 'my-command',
  description: 'Description of what it does',
  args: [
    { name: 'param', type: 'string', required: true, description: 'A parameter' }
  ],
  selfInvokable: true,
  triggers: ['pattern.*to.*match'],
};

export async function execute(
  args: Record<string, unknown>,
  context?: ExecutionContext
): Promise<CommandResult> {
  // Your implementation
  return {
    success: true,
    output: 'Command completed successfully',
  };
}
```

Add a `prompt.md` file to document when Claude should invoke the command.

### Python Command

Create `commands/py/<name>/__init__.py`:

```python
from dataclasses import dataclass
from typing import Optional, List, Dict, Any

@dataclass
class CommandConfig:
    name: str
    description: str
    args: Optional[List[dict]] = None
    self_invokable: bool = False
    triggers: Optional[List[str]] = None

@dataclass
class CommandResult:
    success: bool
    output: str
    error: Optional[str] = None

config = CommandConfig(
    name="my-command",
    description="Description of what it does",
    self_invokable=True,
    triggers=[r"pattern.*to.*match"],
)

async def execute(args: Dict[str, Any], context=None) -> CommandResult:
    # Your implementation
    return CommandResult(success=True, output="Done!")
```

## Project Structure

```
claude-commands/
├── package.json              # Node.js config
├── tsconfig.json             # TypeScript config
├── pyproject.toml            # Python config
├── src/
│   ├── types.ts              # Type definitions
│   ├── registry.ts           # Command discovery
│   ├── executor.ts           # Command execution
│   ├── cli.ts                # CLI entry point
│   └── index.ts              # Public API
├── commands/
│   ├── ts/                   # TypeScript commands
│   └── py/                   # Python commands
├── hooks/
│   └── post-tool.sh          # Claude Code hook
└── .claude/
    └── settings.json         # Project settings
```

## Development

```bash
# Type check
npm run typecheck

# Build
npm run build

# Run in development mode
npm run dev
```

## License

MIT
