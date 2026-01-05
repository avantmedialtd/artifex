# Proposal: Add Scaffold Test Compose Command

## Summary

Add a new `af scaffold test-compose` subcommand that generates a `docker-compose.test.yml` file for E2E testing. This overlay compose file adds a `migrate-seed` init container and configures service dependencies to ensure migrations run before tests execute.

## Motivation

E2E testing requires a properly initialized database with migrations and seed data. Currently, developers must manually create and maintain the test compose overlay file. Automating this with a scaffold command ensures consistency and reduces setup friction.

## What Changes

### New Command Structure

- Add `scaffold` as a new top-level command
- Add `test-compose` as the first subcommand under `scaffold`
- The command writes a `docker-compose.test.yml` file to the current directory

### File Generation

The command generates a Docker Compose overlay file with:

- A `migrate-seed` service that runs migrations before other services start
- Override configurations for `hosting-server` and `e2e` services to depend on successful migration
- Proper networking and environment configuration for the testing profile

### Command Behavior

- `af scaffold test-compose` - Generates the file
- If `docker-compose.test.yml` already exists, show error and exit (no overwrite by default)

## Impact

- **New capability**: Scaffolding commands for project setup
- **No breaking changes**: Adds new command, does not modify existing behavior
- **Low risk**: File generation is a safe, reversible operation

## Out of Scope

- Interactive prompts for customization
- Template variables or configuration options
- Other scaffold subcommands (future work)
