#!/bin/bash
#
# Post-tool hook for Claude Code
# Suggests slash commands based on tool call outcomes
#

# Get the tool name and result from environment or stdin
TOOL_NAME="${CLAUDE_TOOL_NAME:-}"
TOOL_RESULT="${CLAUDE_TOOL_RESULT:-}"
FILE_PATH="${CLAUDE_FILE_PATH:-}"

# Project root (parent of hooks directory)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Function to suggest a command
suggest_command() {
    local cmd="$1"
    local reason="$2"
    echo "💡 Suggestion: Consider running /$cmd - $reason"
}

# Function to check triggers
check_triggers() {
    local context="$1"
    cd "$PROJECT_ROOT" && npm run run triggers "$context" 2>/dev/null
}

# Handle Edit tool - file was modified
if [[ "$TOOL_NAME" == "Edit" || "$TOOL_NAME" == "Write" ]]; then
    if [[ -n "$FILE_PATH" ]]; then
        # Check for test file edits
        if [[ "$FILE_PATH" =~ \.(spec|test)\.(ts|tsx|js|jsx)$ ]] || [[ "$FILE_PATH" =~ e2e/ ]]; then
            suggest_command "test-playwright" "Test file was modified"
        fi

        # Check for source file edits (not test files)
        if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]] && [[ ! "$FILE_PATH" =~ \.(spec|test)\. ]]; then
            suggest_command "lint-fix" "Source file was modified"
        fi

        # Check for migration-related edits
        if [[ "$FILE_PATH" =~ migration ]] || [[ "$FILE_PATH" =~ schema ]]; then
            suggest_command "db-migrate" "Migration-related file was modified"
        fi
    fi
fi

# Handle Bash tool - check for error patterns
if [[ "$TOOL_NAME" == "Bash" ]]; then
    # Check if result contains error patterns
    if echo "$TOOL_RESULT" | grep -qiE "(error|exception|traceback|failed|ENOENT|EACCES)"; then
        suggest_command "analyze-errors" "Error detected in command output"
    fi

    # Check if a build or test command was run
    if echo "$TOOL_RESULT" | grep -qiE "(npm test|pytest|jest|vitest|playwright)"; then
        # If tests passed, might be ready to commit
        if echo "$TOOL_RESULT" | grep -qiE "(passed|success|✓)"; then
            suggest_command "commit" "Tests passed - ready to commit?"
        fi
    fi
fi

# Check custom triggers
if [[ -n "$FILE_PATH" ]]; then
    check_triggers "edited $FILE_PATH"
fi

exit 0
