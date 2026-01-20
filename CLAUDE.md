# Claude Commands Project

A modular slash commands system for Claude Code supporting TypeScript and Python commands with self-invocation capability.

## Available Slash Commands

### TypeScript Commands

| Command | Description | Self-Invoke |
|---------|-------------|-------------|
| `/commit` | Smart git commit with conventional commit format | ✓ |
| `/review-pr` | PR review with automated checklist | ✓ |
| `/test-playwright` | Run Playwright tests (never swallows errors) | ✓ |
| `/lint-fix` | Run linter and auto-fix issues | ✓ |
| `/gen-docs` | Generate API documentation from code | |

### Python Commands

| Command | Description | Self-Invoke |
|---------|-------------|-------------|
| `/analyze-errors` | Parse and explain error logs | ✓ |
| `/db-migrate` | PostgreSQL migration helper | ✓ |
| `/ml-predict` | Run ML model inference | |

## Self-Invocation Rules

Commands marked with self-invoke can be automatically suggested based on context:

### After Editing Files
- **Test files** (`*.spec.ts`, `*.test.ts`, `e2e/*`) → Consider `/test-playwright`
- **Source files** with linting errors → Consider `/lint-fix`

### After Completing Work
- Finished a feature → Suggest `/commit`
- Ready to merge → Suggest `/review-pr`

### When Encountering Errors
- Stack traces or exceptions → Use `/analyze-errors`
- Database schema changes → Consider `/db-migrate`

## Running Commands

### Via CLI
```bash
# List all commands
npm run list

# Run a specific command
npm run run commit message="feat: add feature"
npm run run test-playwright
npm run run lint-fix format=true

# Check for trigger matches
npm run run triggers "edited src/test.spec.ts"
```

### Via Claude
Simply mention the command in conversation:
- "Please `/commit` these changes"
- "Run `/test-playwright` to verify"
- "Can you `/analyze-errors` on this stack trace"

## Project Structure

```
claude-commands/
├── src/
│   ├── types.ts       # Type definitions
│   ├── registry.ts    # Command discovery
│   ├── executor.ts    # Command execution
│   └── cli.ts         # CLI entry point
├── commands/
│   ├── ts/            # TypeScript commands
│   │   ├── commit/
│   │   ├── review-pr/
│   │   ├── test-playwright/
│   │   ├── lint-fix/
│   │   └── gen-docs/
│   └── py/            # Python commands
│       ├── analyze-errors/
│       ├── db-migrate/
│       └── ml-predict/
└── hooks/             # Claude Code hooks
```

## Creating New Commands

### TypeScript Command

Create `commands/ts/<name>/index.ts`:

```typescript
import type { CommandConfig, CommandResult } from '../../../src/types.js';

export const config: CommandConfig = {
  name: 'my-command',
  description: 'What it does',
  selfInvokable: true,
  triggers: ['pattern.*to.*match'],
};

export async function execute(args: Record<string, unknown>): Promise<CommandResult> {
  return { success: true, output: 'Done!' };
}
```

### Python Command

Create `commands/py/<name>/__init__.py`:

```python
from dataclasses import dataclass
from typing import Optional, List, Dict, Any

@dataclass
class CommandConfig:
    name: str
    description: str
    self_invokable: bool = False
    triggers: Optional[List[str]] = None

config = CommandConfig(
    name="my-command",
    description="What it does",
)

async def execute(args: Dict[str, Any], context=None) -> CommandResult:
    return CommandResult(success=True, output="Done!")
```

## Development

```bash
# Install dependencies
npm install

# Type check
npm run typecheck

# Run in development
npm run dev
```
