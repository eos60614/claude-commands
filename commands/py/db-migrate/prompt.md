# /db-migrate Command

PostgreSQL migration helper for creating, validating, and managing database migrations.

## When to Invoke

Consider invoking `/db-migrate` when:
- User needs to create a database migration
- User modifies database schema
- User mentions ALTER TABLE, CREATE TABLE, ADD COLUMN
- Before deploying database changes
- User asks about migration best practices

## Usage

```
/db-migrate action=<action> [name=...] [path=migrations]
```

## Actions

### create
Create a new migration file with template.

```bash
/db-migrate action=create name="add_users_table"
```

### validate
Validate all migrations for common issues.

```bash
/db-migrate action=validate
```

### list
List all migrations in the directory.

```bash
/db-migrate action=list
```

## Arguments

- `action` - Action to perform: `create`, `validate`, `list`, `generate` (required)
- `name` - Migration name for create action
- `path` - Migrations directory (default: `migrations`)

## Validation Checks

The validator checks for:

### Errors
- DROP TABLE without IF EXISTS
- DROP COLUMN without IF EXISTS
- TRUNCATE TABLE (destructive)
- DELETE/UPDATE without WHERE clause

### Warnings
- Missing BEGIN/COMMIT transaction
- Adding NOT NULL column without DEFAULT
- Missing DOWN migration

### Info
- CREATE INDEX without CONCURRENTLY

## Migration Template

Created migrations include:
- Timestamp prefix for ordering
- UP migration section with transaction
- DOWN migration section (commented) for rollback
- Example SQL patterns

## Self-Invocation Triggers

This command has `self_invokable: True` and will be suggested when context matches:
- `database.*migration`
- `schema.*change`
- `alter.*table`
- `create.*table`
- `add.*column`
