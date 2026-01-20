# /lint-fix Command

Run linter and auto-fix issues. Supports ESLint, Biome, and Ruff.

## When to Invoke

Consider invoking `/lint-fix` when:
- User encounters linting errors
- Before committing code
- User asks to fix code style issues
- After making significant code changes
- User mentions "eslint", "lint", or "formatting"

## Usage

```
/lint-fix [path=.] [fix=true] [format=true]
```

## Arguments

- `path` - Path to lint (default: `.`)
- `fix` - Auto-fix issues (default: `true`)
- `format` - Also run formatter like Prettier (default: `false`)

## Examples

```bash
# Lint and fix current directory
/lint-fix

# Lint specific path without fixing
/lint-fix path=src fix=false

# Lint and format
/lint-fix format=true

# Lint specific file
/lint-fix path=src/components/Button.tsx
```

## Supported Linters

The command auto-detects the linter based on config files:

- **ESLint** - `.eslintrc.*` or `eslint.config.*`
- **Biome** - `biome.json` or `biome.jsonc`
- **Ruff** - `ruff.toml`, `.ruff.toml`, or `pyproject.toml`

## Formatter Support

When `format=true`, it will also run:
- **Prettier** (if `.prettierrc` exists)
- **Biome format** (if using Biome)
- **Ruff format** (if using Ruff)

## Self-Invocation Triggers

This command has `selfInvokable: true` and will be suggested when context matches:
- `lint.*error`
- `fix.*lint`
- `eslint.*error`
- `formatting.*issue`
