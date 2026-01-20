# /test-playwright Command

Run Playwright end-to-end tests with full error output. This command never swallows errors - all failures are reported in detail.

## When to Invoke

Consider invoking `/test-playwright` when:
- User edits any `.spec.ts` or `.test.ts` file
- User edits files in an `e2e` directory
- User asks to run tests or verify changes
- After implementing a feature that has e2e tests
- User mentions "playwright" or "e2e tests"

## Usage

```
/test-playwright [file=...] [headed=true] [debug=true] [project=...] [grep=...] [retries=N]
```

## Arguments

- `file` - Specific test file or pattern to run
- `headed` - Run tests in headed (visible browser) mode
- `debug` - Run tests in debug mode with Playwright Inspector
- `project` - Run tests for specific browser (chromium, firefox, webkit)
- `grep` - Filter tests by regex pattern
- `retries` - Number of retries for flaky tests

## Examples

```bash
# Run all tests
/test-playwright

# Run specific test file
/test-playwright file=tests/login.spec.ts

# Run in headed mode for debugging
/test-playwright headed=true

# Run only chromium tests
/test-playwright project=chromium

# Run tests matching pattern
/test-playwright grep="login|auth"

# Run with retries for flaky tests
/test-playwright retries=2
```

## Error Handling

This command is designed to **never swallow errors**:
- Full stdout/stderr is captured and displayed
- Failed test details are extracted and highlighted
- Exit codes are preserved
- Error stack traces are included

## Self-Invocation Triggers

This command has `selfInvokable: true` and will be suggested when context matches:
- `edited.*\.spec\.ts`
- `edited.*\.test\.ts`
- `edited.*e2e.*`
- `edited.*playwright.*`
- `run.*test`
- `test.*playwright`
