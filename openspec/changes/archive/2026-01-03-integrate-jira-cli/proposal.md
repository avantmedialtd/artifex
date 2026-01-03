# Proposal: Integrate Jira CLI

## Why

A standalone Jira CLI tool exists in the `jira/` folder that provides comprehensive Jira issue management from the command line. Integrating it into the `af` CLI will provide a unified developer experience and enable project-specific Jira configuration via `.env` files in the working directory.

## What Changes

- Add global `.env` loading from current working directory (non-failing if missing)
- Integrate Jira CLI as `af jira <subcommand>` commands
- Add Jira command routing and help documentation
- Refactor Jira config to use global env loading with lazy validation

## Impact

- Affected specs: NEW `jira-command`, NEW `global-env-loading`
- Affected code:
  - `utils/env.ts` (new)
  - `main.ts` (add env loading)
  - `commands/jira.ts` (new)
  - `router.ts` (add jira routing)
  - `commands/help.ts` (add jira help)
  - `jira/lib/config.ts` (refactor to use global env)
