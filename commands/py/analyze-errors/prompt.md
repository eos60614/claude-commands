# /analyze-errors Command

Parse and explain error logs with actionable suggestions.

## When to Invoke

Consider invoking `/analyze-errors` when:
- User encounters an error or exception
- Stack traces appear in the conversation
- User asks "what does this error mean?"
- Build or test failures occur
- User shares error logs

## Usage

```
/analyze-errors log="<error text>" [format=auto|json|plain]
```

## Arguments

- `log` - Error log text or file path (required)
- `format` - Log format: `auto`, `json`, or `plain` (default: `auto`)

## Examples

```bash
# Analyze error text
/analyze-errors log="ModuleNotFoundError: No module named 'requests'"

# Analyze from file
/analyze-errors log=/var/log/app.log

# Specify format
/analyze-errors log='{"error": "connection refused"}' format=json
```

## Supported Error Types

### Python Errors
- ModuleNotFoundError
- ImportError
- TypeError
- AttributeError
- KeyError
- ValueError
- FileNotFoundError
- PermissionError

### JavaScript Errors
- ReferenceError
- TypeError
- SyntaxError
- ENOENT (file not found)
- Module not found

### Database Errors
- Connection refused
- Integrity errors
- Duplicate entries

### Network Errors
- Connection refused
- Timeouts
- HTTP status errors (400-504)

## Output

The command provides:
1. **Error identification** - What error was detected
2. **Explanation** - What the error means
3. **Stack trace analysis** - Where the error originated
4. **Suggestions** - How to fix the issue

## Self-Invocation Triggers

This command has `self_invokable: True` and will be suggested when context matches:
- `error.*occurred`
- `exception.*thrown`
- `failed.*with`
- `traceback`
- `stack.*trace`
