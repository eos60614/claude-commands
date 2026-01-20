# /commit Command

Create a smart git commit using conventional commit format.

## When to Invoke

Consider invoking `/commit` when:
- User says they've completed a feature or task
- User explicitly asks to commit changes
- After a series of file edits that represent a logical unit of work
- User mentions being "ready to commit" or similar phrases

## Usage

```
/commit [message="..."] [type=feat|fix|docs|style|refactor|test|chore] [scope=...] [all=true]
```

## Arguments

- `message` - Custom commit message (optional, auto-generated if not provided)
- `type` - Commit type (default: inferred from files)
  - `feat` - New feature
  - `fix` - Bug fix
  - `docs` - Documentation changes
  - `style` - Formatting, styling changes
  - `refactor` - Code refactoring
  - `test` - Adding or updating tests
  - `chore` - Maintenance tasks
- `scope` - Optional scope (e.g., `api`, `ui`, `core`)
- `all` - Stage all changes before committing (default: false)

## Examples

```bash
# Auto-generate commit message from staged changes
/commit

# Commit with custom message
/commit message="add user authentication"

# Commit with type and scope
/commit type=fix scope=api message="handle null response"

# Stage all and commit
/commit all=true message="update dependencies"
```

## Behavior

1. Checks for staged changes
2. If no staged changes, reports error (unless `all=true`)
3. Infers commit type from file names if not specified
4. Generates descriptive commit message if not provided
5. Creates commit with conventional commit format

## Self-Invocation Triggers

This command has `selfInvokable: true` and will be suggested when context matches:
- `completed.*feature`
- `finished.*implementation`
- `ready.*commit`
