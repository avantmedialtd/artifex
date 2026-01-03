# Add Commit Work Command

## Why

Developers using OpenSpec need a quick way to commit their work with the proposal title and OpenSpec ID as a git trailer. Currently, this requires manually running `af commit save` with the correct arguments.

## What Changes

- Add new Claude command `commit-work.md` that commits all changes with the OpenSpec proposal title and ID
- Command accepts optional OpenSpec ID and title as arguments
- When called without arguments, infers ID from `openspec list` and title from `proposal.md`
- Calls `af commit save "<title>" OpenSpec-Id=<openspec-id>`

## Impact

- Affected specs: setup-command (new bundled command file)
- Affected code: `setup/.claude/commands/commit-work.md`
