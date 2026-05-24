## Context

`commands/bitbucket.ts` has a fully generic flag parser: any `--xyz <value>` lands in `options.xyz`, with special sets for booleans, numbers, and repeatable flags. The `pr create` handler reads `options.from` and `options.to` directly to derive the PR's source and destination branches.

There is no existing alias mechanism in this parser — or anywhere else in the CLI surface — so this change introduces one. The mechanism needs to be small enough to not feel over-engineered for the four entries it gets today, and shaped enough that the next alias request is a one-line patch rather than a re-decision.

## Goals / Non-Goals

**Goals:**

- `--source` / `--src` resolve to `--from`; `--destination` / `--dest` resolve to `--to`, for `af bb pr create`.
- The resolution mechanism is reusable for future aliases on this command without further design work.
- The `pr create` handler code is unchanged; aliases are invisible past the parser boundary.
- Behavior on conflicting flags (e.g. `--to A --dest B`) is explicit and documented.

**Non-Goals:**

- A general CLI-wide alias system across `jira`, `confluence`, `sonar`, etc. Each command owns its own parser; we are not unifying them in this change.
- Aliases on other `bb` subcommands (`pr update`, `pr merge`, …). `pr create` is what users hit first when overriding branches; the others can be added if asked.
- Deprecating `--from` / `--to`. They remain the canonical names everywhere documentation refers to them.

## Decisions

### Decision: Resolve aliases at parse time via a normalization map

A `FLAG_ALIASES: Map<string, string>` lives next to `BOOLEAN_FLAGS` / `NUMBER_FLAGS` / `REPEATABLE_FLAGS` in `commands/bitbucket.ts`. At the top of the `parseArgs` loop, the raw token is normalized:

```
const arg = FLAG_ALIASES.get(rawArg) ?? rawArg;
```

Everything downstream (boolean detection, number detection, generic `--key value`) operates on the canonical name. The PR create handler at `commands/bitbucket.ts:376` is untouched.

**Alternative considered: resolve at the use site.** A line like `options.to ?? options.destination ?? options.dest` in the handler plus three new optional fields on `BitbucketOptions`. Rejected because (a) it spreads the alias contract across the file, (b) the interface accumulates phantom fields that exist only to be read once and forwarded, and (c) the next alias request reopens the same design conversation.

**Alternative considered: per-flag alias declarations.** Replace each `--foo` literal with a `{canonical: '--foo', aliases: ['--foo-bar']}` record. Rejected as over-engineered for a parser that today has zero alias entries; a flat map is simpler and equally extensible.

### Decision: Last-write-wins on conflict

If a user passes both `--to main --dest develop`, the loop's existing generic branch assigns `options.to = 'main'` then overwrites with `options.to = 'develop'`. The later token wins.

This is not new behavior — the same is already true if someone passes `--to main --to develop` today — but the alias case makes it newly reachable, so the spec calls it out as a scenario rather than leaving it as undocumented emergent behavior.

**Alternative considered: error on conflict.** Detect that both a canonical and an alias were supplied and exit non-zero. Rejected because it adds parser state (tracking which keys were already written) to defend against a mistake that is harmless in practice — both values are valid branch names, and the user gets the one they typed most recently. Erroring would also be inconsistent with how the parser treats duplicate canonical flags today.

### Decision: Document aliases in help, not in the usage signature

The `pr create` line in the help block stays as `[--from B] [--to B]`. A short note follows the block listing the accepted alias spellings. This keeps the usage signature scannable while still surfacing the aliases for users who read the help.

## Risks / Trade-offs

- **Risk: Last-write-wins surprises a user who passes both flags expecting a validation error.** → Mitigation: spec scenario makes the behavior explicit; help text need not call it out (it would be noise for the common case).
- **Risk: The alias map drifts out of sync with reality if someone renames a canonical flag.** → Mitigation: low — the map lives ten lines from the flag sets and the test suite covers the resolution, so a rename that breaks an alias fails a test immediately.
- **Trade-off: A single map in `commands/bitbucket.ts` doesn't help other commands.** → Accepted; cross-command unification is a non-goal here and would be premature without a second user.
