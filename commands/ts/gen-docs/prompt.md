# /gen-docs Command

Generate API documentation from source code by parsing JSDoc comments and type definitions.

## When to Invoke

Consider invoking `/gen-docs` when:
- User asks for documentation generation
- After completing a module or feature
- User wants to create API reference
- Before publishing a package

## Usage

```
/gen-docs [path=src] [output=docs/API.md] [format=markdown]
```

## Arguments

- `path` - Path to document (file or directory, default: `src`)
- `output` - Output file path (default: `docs/API.md`)
- `format` - Output format: `markdown` or `json` (default: `markdown`)

## Examples

```bash
# Generate docs for src directory
/gen-docs

# Generate docs for specific directory
/gen-docs path=lib

# Generate JSON output
/gen-docs format=json output=docs/api.json

# Generate docs for single file
/gen-docs path=src/utils.ts
```

## What It Documents

### Functions
- Function name and signature
- JSDoc description
- Parameters with types
- Return type and description
- Async indicator
- Export status

### Interfaces
- Interface name
- JSDoc description
- Properties with types
- Required/optional status

## Output Format

### Markdown (default)
Generates a structured markdown document with:
- Table of contents
- File-by-file documentation
- Tables for interface properties
- Parameter lists for functions

### JSON
Generates structured JSON suitable for:
- Custom documentation sites
- API explorers
- Further processing

## Supported File Types

- TypeScript (`.ts`, `.tsx`)
- JavaScript (`.js`, `.jsx`)

## Self-Invocation

This command is NOT self-invokable as documentation generation is typically an explicit user request.
