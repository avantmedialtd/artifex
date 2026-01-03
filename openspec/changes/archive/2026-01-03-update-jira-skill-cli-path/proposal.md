# Update Jira Skill CLI Path

## Why

The jira skill documentation references `./scripts/jira/jira.ts` which doesn't exist. The jira CLI functionality was implemented as an `af jira` subcommand, so all documentation needs to be updated to use the correct command path.

## What Changes

- Update all `./scripts/jira/jira.ts` references to `af jira` in skill documentation
- Update setup instructions to reference project `.env` file instead of `scripts/jira/.env`
- Update all example commands across jira skill, pm skill, and related command files

## Impact

- Affected files:
  - `setup/.claude/skills/jira/SKILL.md` - Main jira skill documentation
  - `setup/.claude/skills/pm/SKILL.md` - Project management skill (uses jira commands)
  - `setup/.claude/skills/pm/templates/*.md` - PM templates with jira examples
  - `setup/.claude/commands/start-work.md` - Start work command
  - `setup/.claude/commands/complete-work.md` - Complete work command
- No code changes required - documentation only
