"""
/db-migrate - PostgreSQL migration helper
"""

from dataclasses import dataclass
from typing import Optional, List, Dict, Any
import os
import re
from datetime import datetime


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
    name="db-migrate",
    description="PostgreSQL migration helper - create, validate, and manage migrations",
    args=[
        {
            "name": "action",
            "description": "Action to perform (create, validate, list, generate)",
            "type": "string",
            "required": True,
        },
        {
            "name": "name",
            "description": "Migration name (for create action)",
            "type": "string",
            "required": False,
        },
        {
            "name": "path",
            "description": "Migrations directory path",
            "type": "string",
            "required": False,
            "default": "migrations",
        },
    ],
    self_invokable=True,
    triggers=[
        r"database.*migration",
        r"schema.*change",
        r"alter.*table",
        r"create.*table",
        r"add.*column",
    ],
)


def generate_migration_filename(name: str) -> str:
    """Generate a migration filename with timestamp."""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    # Sanitize name
    safe_name = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return f"{timestamp}_{safe_name}.sql"


def create_migration_template(name: str) -> str:
    """Create a migration file template."""
    return f"""-- Migration: {name}
-- Created: {datetime.now().isoformat()}

-- ============================================
-- UP Migration
-- ============================================

BEGIN;

-- Add your migration SQL here
-- Example:
-- CREATE TABLE users (
--     id SERIAL PRIMARY KEY,
--     email VARCHAR(255) UNIQUE NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

COMMIT;

-- ============================================
-- DOWN Migration (for rollback)
-- ============================================

-- BEGIN;
--
-- DROP TABLE IF EXISTS users;
--
-- COMMIT;
"""


def validate_migration(content: str) -> List[Dict[str, str]]:
    """Validate migration file for common issues."""
    issues = []

    # Check for transaction wrapping
    if "BEGIN" not in content.upper() or "COMMIT" not in content.upper():
        issues.append({
            "severity": "warning",
            "message": "Migration should be wrapped in BEGIN/COMMIT transaction",
        })

    # Check for dangerous operations without safeguards
    dangerous_patterns = [
        (r"DROP\s+TABLE\s+(?!IF\s+EXISTS)", "DROP TABLE without IF EXISTS"),
        (r"DROP\s+COLUMN\s+(?!IF\s+EXISTS)", "DROP COLUMN without IF EXISTS"),
        (r"TRUNCATE\s+TABLE", "TRUNCATE TABLE is destructive"),
        (r"DELETE\s+FROM\s+\w+\s*;", "DELETE without WHERE clause"),
        (r"UPDATE\s+\w+\s+SET\s+.+\s*;(?!.*WHERE)", "UPDATE without WHERE clause"),
    ]

    for pattern, message in dangerous_patterns:
        if re.search(pattern, content, re.IGNORECASE):
            issues.append({
                "severity": "error",
                "message": message,
            })

    # Check for nullable columns without defaults
    if re.search(r"ADD\s+COLUMN\s+\w+\s+\w+\s+NOT\s+NULL(?!\s+DEFAULT)", content, re.IGNORECASE):
        issues.append({
            "severity": "warning",
            "message": "Adding NOT NULL column without DEFAULT may fail on existing rows",
        })

    # Check for index creation that might lock table
    if re.search(r"CREATE\s+INDEX\s+(?!CONCURRENTLY)", content, re.IGNORECASE):
        issues.append({
            "severity": "info",
            "message": "Consider using CREATE INDEX CONCURRENTLY to avoid table locks",
        })

    # Check for down migration
    if "DOWN" not in content.upper():
        issues.append({
            "severity": "warning",
            "message": "No DOWN migration defined for rollback",
        })

    return issues


def list_migrations(migrations_dir: str) -> List[Dict[str, Any]]:
    """List all migrations in the directory."""
    migrations = []

    if not os.path.isdir(migrations_dir):
        return migrations

    for filename in sorted(os.listdir(migrations_dir)):
        if filename.endswith(".sql"):
            filepath = os.path.join(migrations_dir, filename)
            stat = os.stat(filepath)

            # Parse timestamp from filename
            timestamp_match = re.match(r"(\d{14})", filename)
            timestamp = timestamp_match.group(1) if timestamp_match else None

            migrations.append({
                "filename": filename,
                "path": filepath,
                "size": stat.st_size,
                "timestamp": timestamp,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })

    return migrations


def generate_migration_from_diff(old_schema: str, new_schema: str) -> str:
    """Generate migration SQL from schema diff (simplified)."""
    # This is a simplified implementation
    # A real implementation would parse SQL schemas and compare them

    lines = [
        "-- Auto-generated migration",
        f"-- Generated: {datetime.now().isoformat()}",
        "",
        "BEGIN;",
        "",
        "-- TODO: Review and modify this auto-generated migration",
        "-- This is a basic diff and may need adjustments",
        "",
    ]

    # Find tables in new schema that aren't in old
    new_tables = set(re.findall(r"CREATE\s+TABLE\s+(\w+)", new_schema, re.IGNORECASE))
    old_tables = set(re.findall(r"CREATE\s+TABLE\s+(\w+)", old_schema, re.IGNORECASE))

    for table in new_tables - old_tables:
        # Extract CREATE TABLE statement
        pattern = rf"CREATE\s+TABLE\s+{table}\s*\([^;]+\);"
        match = re.search(pattern, new_schema, re.IGNORECASE | re.DOTALL)
        if match:
            lines.append(match.group(0))
            lines.append("")

    for table in old_tables - new_tables:
        lines.append(f"DROP TABLE IF EXISTS {table};")
        lines.append("")

    lines.extend([
        "COMMIT;",
        "",
        "-- DOWN Migration",
        "-- BEGIN;",
    ])

    for table in new_tables - old_tables:
        lines.append(f"-- DROP TABLE IF EXISTS {table};")

    lines.append("-- COMMIT;")

    return "\n".join(lines)


async def execute(args: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> CommandResult:
    """Execute the db-migrate command."""
    action = args.get("action", "").lower()
    name = args.get("name", "")
    migrations_dir = args.get("path", "migrations")

    cwd = context.get("cwd", os.getcwd()) if context else os.getcwd()
    migrations_path = os.path.join(cwd, migrations_dir)

    if action == "create":
        if not name:
            return CommandResult(
                success=False,
                output="",
                error="Migration name is required for create action",
            )

        # Ensure migrations directory exists
        os.makedirs(migrations_path, exist_ok=True)

        filename = generate_migration_filename(name)
        filepath = os.path.join(migrations_path, filename)

        content = create_migration_template(name)

        with open(filepath, "w") as f:
            f.write(content)

        return CommandResult(
            success=True,
            output=f"Created migration: {filepath}\n\nEdit the file to add your migration SQL.",
        )

    elif action == "validate":
        if not os.path.isdir(migrations_path):
            return CommandResult(
                success=False,
                output="",
                error=f"Migrations directory not found: {migrations_path}",
            )

        all_issues = []
        for migration in list_migrations(migrations_path):
            with open(migration["path"], "r") as f:
                content = f.read()

            issues = validate_migration(content)
            if issues:
                all_issues.append({
                    "file": migration["filename"],
                    "issues": issues,
                })

        if not all_issues:
            return CommandResult(
                success=True,
                output="All migrations validated successfully. No issues found.",
            )

        output_lines = ["# Migration Validation Results", ""]
        has_errors = False

        for file_issues in all_issues:
            output_lines.append(f"## {file_issues['file']}")
            for issue in file_issues["issues"]:
                icon = {"error": "❌", "warning": "⚠️", "info": "ℹ️"}.get(issue["severity"], "•")
                output_lines.append(f"- {icon} [{issue['severity'].upper()}] {issue['message']}")
                if issue["severity"] == "error":
                    has_errors = True
            output_lines.append("")

        return CommandResult(
            success=not has_errors,
            output="\n".join(output_lines),
            error="Validation found errors" if has_errors else None,
        )

    elif action == "list":
        migrations = list_migrations(migrations_path)

        if not migrations:
            return CommandResult(
                success=True,
                output=f"No migrations found in {migrations_path}",
            )

        output_lines = [
            "# Migrations",
            "",
            f"**Directory:** {migrations_path}",
            f"**Total:** {len(migrations)}",
            "",
            "| # | Filename | Size | Modified |",
            "|---|----------|------|----------|",
        ]

        for i, migration in enumerate(migrations, 1):
            output_lines.append(
                f"| {i} | {migration['filename']} | {migration['size']} bytes | {migration['modified']} |"
            )

        return CommandResult(
            success=True,
            output="\n".join(output_lines),
        )

    elif action == "generate":
        return CommandResult(
            success=False,
            output="",
            error="Schema diff generation requires old_schema and new_schema files. Use: action=generate old=schema_old.sql new=schema_new.sql",
        )

    else:
        return CommandResult(
            success=False,
            output="",
            error=f"Unknown action: {action}. Valid actions: create, validate, list, generate",
        )
