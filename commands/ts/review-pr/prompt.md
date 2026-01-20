# /review-pr Command

Perform an automated PR review with checklist and security scanning.

## When to Invoke

Consider invoking `/review-pr` when:
- User asks to review a pull request
- User wants to check their changes before merging
- Before submitting a PR for human review
- User mentions "code review" or "PR review"

## Usage

```
/review-pr [pr=<number>] [base=main]
```

## Arguments

- `pr` - PR number or URL (optional, reviews current branch if not provided)
- `base` - Base branch to compare against (default: `main`)

## Examples

```bash
# Review current branch against main
/review-pr

# Review against specific base
/review-pr base=develop

# Review specific PR
/review-pr pr=123
```

## What It Checks

### Security Concerns
- Hardcoded passwords, API keys, secrets
- eval() usage
- XSS risks (innerHTML, dangerouslySetInnerHTML)
- Template literal injection risks

### Code Quality
- console.log statements
- debugger statements
- TODO/FIXME comments
- TypeScript `any` usage
- ESLint disable directives

### Generated Checklist
- Compilation status
- Test coverage
- Documentation updates
- Migration safety
- Dependency security
- Configuration changes

## Self-Invocation Triggers

This command has `selfInvokable: true` and will be suggested when context matches:
- `review.*pr`
- `check.*pull.*request`
- `pr.*review`
