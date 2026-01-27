# Proposal: Add Jira Version Support

## Why

The Jira CLI currently supports issues, comments, transitions, assignments, and time tracking, but lacks support for Jira versions (also known as releases). Versions are essential for release planning workflows - they allow teams to track which issues are fixed in a release (`fixVersions`) and which versions are affected by bugs (`affectedVersions`). Without version support, users must switch to the Jira web UI for release management tasks.

## What Changes

- **List project versions**: New `af jira versions <project>` command to list all versions in a project with their release status, dates, and descriptions
- **Get version details**: New `af jira version <version-id>` command to display detailed version information
- **Create version**: New `af jira version-create` command with `--project`, `--name`, `--description`, `--start-date`, `--release-date`, and `--released` options
- **Update version**: New `af jira version-update <version-id>` command to modify version properties including marking as released/unreleased
- **Delete version**: New `af jira version-delete <version-id>` command to remove a version
- **Set fix versions on issues**: Add `--fix-version` option to `create` and `update` commands
- **Set affected versions on issues**: Add `--affected-version` option to `create` and `update` commands
- **Display versions on issues**: Show fix versions and affected versions when viewing issue details with `af jira get`

## Impact

- Affected specs: `jira-command`
- Affected code:
  - `jira/lib/types.ts` - Add JiraVersion type
  - `jira/lib/client.ts` - Add version API functions
  - `jira/lib/formatters.ts` - Add version formatting functions
  - `commands/jira.ts` - Add version subcommands and options
