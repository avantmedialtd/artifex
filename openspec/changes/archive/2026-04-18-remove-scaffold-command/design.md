## Context

The `af scaffold test-compose` command generates a single hardcoded `docker-compose.test.yml` template embedded in the CLI. The template is project-specific and has been replaced by a skill that lives in the consumer repository. Keeping the command in `af` forces a CLI release every time the template drifts, and creates a second source of truth that can silently fall out of sync.

The command is small and self-contained: one handler (`commands/scaffold.ts`), one route in `router.ts`, two entries in `commands/help.ts`, one capability spec. No other module imports it.

## Goals / Non-Goals

**Goals:**
- Fully remove `af scaffold` so the command and its subcommands stop existing
- Remove the `scaffold-test-compose` capability from the specs
- Leave the help output internally consistent (no dangling references)

**Non-Goals:**
- Providing a migration shim or deprecation warning — the replacement lives outside this repo, and the command has no known ongoing consumers inside this repo
- Reworking the router or help system — this is a targeted removal
- Archiving or relocating the generated-template content — the skill in the consumer repo is now the source of truth

## Decisions

**Hard removal, no deprecation window.**
The replacement skill lives in another repository and is already in use. A deprecation warning inside `af` would only help users who run `af scaffold test-compose` in the interim, which we don't expect. Keeping the command around adds maintenance surface (spell-check, tests, help) for no user benefit.

_Alternative considered:_ ship one release that prints a "moved to <skill>" message, then remove in the next. Rejected — the user population is small enough that the direct removal is fine, and we don't have a URL to point at that's stable across users' setups.

**Remove the capability spec, don't repurpose it.**
The `scaffold-test-compose` capability describes the exact command being removed. There is no residual behavior in `af` to document under that name, so the capability is deleted rather than shrunk.

## Risks / Trade-offs

- **Risk:** A user has `af scaffold test-compose` in a script or README somewhere. → **Mitigation:** The command will exit with "Unknown command" via the existing router fallback; error is clear enough for the user to find the replacement skill.
- **Trade-off:** No in-CLI pointer to the replacement. → Acceptable: the skill is installed independently; an `af` error message shouldn't prescribe which external tool to use.

## Migration Plan

1. Remove code, router entries, and help entries in one commit
2. Remove the `scaffold-test-compose` spec via the archive step (handled by OpenSpec)
3. Ship a new `af` version

No rollback complexity — the change is purely subtractive and the command has no persisted state.
