"""
/analyze-errors - Parse and explain error logs
"""

from dataclasses import dataclass
from typing import Optional, List, Dict, Any
import re
import json


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
    name="analyze-errors",
    description="Parse and explain error logs with suggestions",
    args=[
        {
            "name": "log",
            "description": "Error log text or file path",
            "type": "string",
            "required": True,
        },
        {
            "name": "format",
            "description": "Log format (auto, json, plain)",
            "type": "string",
            "required": False,
            "default": "auto",
        },
    ],
    self_invokable=True,
    triggers=[
        r"error.*occurred",
        r"exception.*thrown",
        r"failed.*with",
        r"traceback",
        r"stack.*trace",
    ],
)


# Common error patterns and explanations
ERROR_PATTERNS = [
    # Python errors
    (
        r"ModuleNotFoundError: No module named '(\w+)'",
        lambda m: f"Python module '{m.group(1)}' is not installed. Try: pip install {m.group(1)}",
    ),
    (
        r"ImportError: cannot import name '(\w+)' from '(\w+)'",
        lambda m: f"Cannot import '{m.group(1)}' from '{m.group(2)}'. Check if it exists or if there's a circular import.",
    ),
    (
        r"TypeError: (\w+)\(\) takes (\d+) positional arguments? but (\d+) (?:was|were) given",
        lambda m: f"Function '{m.group(1)}' expects {m.group(2)} argument(s) but received {m.group(3)}.",
    ),
    (
        r"AttributeError: '(\w+)' object has no attribute '(\w+)'",
        lambda m: f"Object of type '{m.group(1)}' doesn't have attribute '{m.group(2)}'. Check spelling or if the object is the correct type.",
    ),
    (
        r"KeyError: ['\"]?(\w+)['\"]?",
        lambda m: f"Dictionary key '{m.group(1)}' not found. Use .get() for safe access or check if key exists.",
    ),
    (
        r"ValueError: (.+)",
        lambda m: f"Invalid value: {m.group(1)}. Validate input data before processing.",
    ),
    (
        r"FileNotFoundError: \[Errno 2\] No such file or directory: ['\"](.+)['\"]",
        lambda m: f"File not found: '{m.group(1)}'. Check the path exists and has correct permissions.",
    ),
    (
        r"PermissionError: \[Errno 13\] Permission denied: ['\"](.+)['\"]",
        lambda m: f"Permission denied for: '{m.group(1)}'. Check file permissions or run with elevated privileges.",
    ),
    # JavaScript/Node errors
    (
        r"ReferenceError: (\w+) is not defined",
        lambda m: f"Variable '{m.group(1)}' is not defined. Check for typos or ensure it's in scope.",
    ),
    (
        r"TypeError: Cannot read propert(?:y|ies) ['\"]?(\w+)['\"]? of (undefined|null)",
        lambda m: f"Tried to access '{m.group(1)}' on {m.group(2)}. Add null checks or optional chaining (?.).",
    ),
    (
        r"SyntaxError: Unexpected token (.+)",
        lambda m: f"Syntax error: unexpected '{m.group(1)}'. Check for missing brackets, quotes, or semicolons.",
    ),
    (
        r"Error: ENOENT: no such file or directory, (?:open|stat) ['\"](.+)['\"]",
        lambda m: f"Node.js cannot find file: '{m.group(1)}'. Verify the path exists.",
    ),
    (
        r"Error: Cannot find module ['\"](.+)['\"]",
        lambda m: f"Node module '{m.group(1)}' not found. Try: npm install {m.group(1).split('/')[0]}",
    ),
    # Database errors
    (
        r"(?:psycopg2\.)?OperationalError.*connection.*refused",
        lambda _: "Database connection refused. Check if the database server is running and accessible.",
    ),
    (
        r"(?:sqlite3\.)?IntegrityError.*UNIQUE constraint failed: (\w+)\.(\w+)",
        lambda m: f"Duplicate value in {m.group(1)}.{m.group(2)}. The value must be unique.",
    ),
    (
        r"(?:mysql\.connector\.)?IntegrityError.*Duplicate entry",
        lambda _: "Duplicate entry violates unique constraint. Check for existing records.",
    ),
    # Network errors
    (
        r"ConnectionRefusedError|ECONNREFUSED",
        lambda _: "Connection refused. The target service may be down or the port may be wrong.",
    ),
    (
        r"TimeoutError|ETIMEDOUT",
        lambda _: "Connection timed out. Check network connectivity and service availability.",
    ),
    (
        r"(?:requests\.exceptions\.)?HTTPError.*(\d{3})",
        lambda m: get_http_error_explanation(int(m.group(1))),
    ),
]


def get_http_error_explanation(status_code: int) -> str:
    """Get explanation for HTTP status codes."""
    explanations = {
        400: "Bad Request - The server couldn't understand the request. Check request format.",
        401: "Unauthorized - Authentication required. Check API keys or login credentials.",
        403: "Forbidden - Access denied. Check permissions and authorization.",
        404: "Not Found - The resource doesn't exist. Verify the URL.",
        405: "Method Not Allowed - Wrong HTTP method. Check if using GET/POST/PUT/DELETE correctly.",
        408: "Request Timeout - The request took too long. Try again or increase timeout.",
        429: "Too Many Requests - Rate limited. Implement backoff and retry logic.",
        500: "Internal Server Error - Server-side issue. Check server logs.",
        502: "Bad Gateway - Proxy/load balancer issue. Check upstream services.",
        503: "Service Unavailable - Server is overloaded or under maintenance.",
        504: "Gateway Timeout - Upstream server didn't respond in time.",
    }
    return explanations.get(status_code, f"HTTP error {status_code}. Check the API documentation.")


def extract_stack_frames(log: str) -> List[Dict[str, str]]:
    """Extract stack frames from error log."""
    frames = []

    # Python traceback
    py_pattern = r'File "([^"]+)", line (\d+), in (\w+)'
    for match in re.finditer(py_pattern, log):
        frames.append({
            "file": match.group(1),
            "line": match.group(2),
            "function": match.group(3),
        })

    # JavaScript stack trace
    js_pattern = r"at (\w+).*?\((.+?):(\d+):\d+\)"
    for match in re.finditer(js_pattern, log):
        frames.append({
            "file": match.group(2),
            "line": match.group(3),
            "function": match.group(1),
        })

    return frames


def detect_log_format(log: str) -> str:
    """Detect the format of the log."""
    try:
        json.loads(log)
        return "json"
    except json.JSONDecodeError:
        pass

    if "Traceback (most recent call last):" in log:
        return "python"
    if re.search(r"at \w+.*?\(.+?:\d+:\d+\)", log):
        return "javascript"

    return "plain"


def analyze_error(log: str, log_format: str = "auto") -> Dict[str, Any]:
    """Analyze error log and provide explanations."""
    if log_format == "auto":
        log_format = detect_log_format(log)

    result = {
        "format_detected": log_format,
        "errors_found": [],
        "suggestions": [],
        "stack_frames": [],
    }

    # Parse JSON logs if applicable
    if log_format == "json":
        try:
            parsed = json.loads(log)
            if isinstance(parsed, dict):
                log = parsed.get("message", "") + " " + parsed.get("error", "") + " " + str(parsed.get("stack", ""))
        except json.JSONDecodeError:
            pass

    # Find matching error patterns
    for pattern, explanation_fn in ERROR_PATTERNS:
        match = re.search(pattern, log, re.IGNORECASE)
        if match:
            result["errors_found"].append({
                "pattern": pattern,
                "match": match.group(0),
                "explanation": explanation_fn(match),
            })

    # Extract stack frames
    result["stack_frames"] = extract_stack_frames(log)

    # Generate general suggestions
    if not result["errors_found"]:
        result["suggestions"].append("No known error patterns matched. Review the full log for context.")

    if result["stack_frames"]:
        first_frame = result["stack_frames"][0]
        result["suggestions"].append(
            f"Error originated in {first_frame['file']}:{first_frame['line']} in function {first_frame['function']}"
        )

    # Add general debugging suggestions
    result["suggestions"].extend([
        "Add logging around the error location for more context",
        "Check if this error is reproducible consistently",
        "Review recent code changes that might have caused this",
    ])

    return result


def format_analysis(analysis: Dict[str, Any]) -> str:
    """Format analysis results as readable text."""
    lines = [
        "# Error Analysis Report",
        "",
        f"**Log Format:** {analysis['format_detected']}",
        "",
    ]

    if analysis["errors_found"]:
        lines.append("## Errors Identified")
        lines.append("")
        for i, error in enumerate(analysis["errors_found"], 1):
            lines.append(f"### Error {i}")
            lines.append(f"**Match:** `{error['match']}`")
            lines.append(f"**Explanation:** {error['explanation']}")
            lines.append("")

    if analysis["stack_frames"]:
        lines.append("## Stack Trace")
        lines.append("")
        for frame in analysis["stack_frames"][:10]:  # Limit to 10 frames
            lines.append(f"- `{frame['file']}:{frame['line']}` in `{frame['function']}`")
        lines.append("")

    if analysis["suggestions"]:
        lines.append("## Suggestions")
        lines.append("")
        for suggestion in analysis["suggestions"]:
            lines.append(f"- {suggestion}")

    return "\n".join(lines)


async def execute(args: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> CommandResult:
    """Execute the analyze-errors command."""
    log_input = args.get("log", "")
    log_format = args.get("format", "auto")

    if not log_input:
        return CommandResult(
            success=False,
            output="",
            error="No log input provided. Use log='...' to provide error text.",
        )

    # Check if input is a file path
    import os
    if os.path.isfile(log_input):
        try:
            with open(log_input, "r") as f:
                log_input = f.read()
        except Exception as e:
            return CommandResult(
                success=False,
                output="",
                error=f"Failed to read log file: {e}",
            )

    try:
        analysis = analyze_error(log_input, log_format)
        output = format_analysis(analysis)

        return CommandResult(
            success=True,
            output=output,
        )
    except Exception as e:
        return CommandResult(
            success=False,
            output="",
            error=f"Analysis failed: {e}",
        )
