# Remove the scaffold command

## Why

The `af scaffold test-compose` command generates a project-specific `docker-compose.test.yml` template that has been replaced by a skill in another repository. File generation for a specific consumer repo isn't `af`'s responsibility — it belongs closer to where the template is consumed, where it can evolve without an `af` release.

## What Changes

- **BREAKING**: Remove the `af scaffold` command and its `test-compose` subcommand
- Remove the `scaffold` entry from the help system
- Remove the `scaffold-test-compose` capability spec

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `scaffold-test-compose`: capability is removed entirely; the `af scaffold test-compose` command no longer exists

## Impact

- **Code**: `commands/scaffold.ts`, `commands/scaffold.test.ts`, `router.ts` (import + route), `commands/help.ts` (help registry entry + usage list item)
- **Specs**: `openspec/specs/scaffold-test-compose/spec.md` removed
- **Users**: Anyone invoking `af scaffold test-compose` must switch to the replacement skill. No automated migration path — the command simply stops existing.
