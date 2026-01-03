---
name: jira-cli
description: Manage Jira issues from the command line. Use when working with Jira issues, creating tasks, updating status, assigning work, or searching for issues.
---

# Jira CLI

Command-line tool for managing Jira issues at `scripts/jira/jira.ts`.

## Setup

Copy `scripts/jira/.env.example` to `scripts/jira/.env` and configure:
- `JIRA_BASE_URL` — Your Jira instance URL (e.g., `https://company.atlassian.net`)
- `JIRA_EMAIL` — Your Atlassian account email
- `JIRA_API_TOKEN` — API token from https://id.atlassian.com/manage-profile/security/api-tokens

## Quick Reference

Run `./scripts/jira/jira.ts --help` for all options.

### Read Operations

- `./scripts/jira/jira.ts get <issue-key>` — Get issue details
- `./scripts/jira/jira.ts list <project> [--limit N]` — List project issues
- `./scripts/jira/jira.ts search "<jql>"` — Search with JQL
- `./scripts/jira/jira.ts projects` — List projects
- `./scripts/jira/jira.ts types <project>` — List issue types
- `./scripts/jira/jira.ts transitions <issue-key>` — List available transitions
- `./scripts/jira/jira.ts comment <issue-key>` — List comments

### Write Operations

- `./scripts/jira/jira.ts create --project <key> --type <type> --summary "<text>" [--description "<text>"] [--priority <name>] [--labels a,b,c] [--parent <key>]`
- `./scripts/jira/jira.ts update <issue-key> [--summary "<text>"] [--description "<text>"] [--priority <name>] [--labels a,b,c]`
- `./scripts/jira/jira.ts transition <issue-key> --to "<status>"`
- `./scripts/jira/jira.ts assign <issue-key> --to <email>` (use `--to none` to unassign)
- `./scripts/jira/jira.ts comment <issue-key> --add "<text>"`
- `./scripts/jira/jira.ts attach <issue-key> <file>` — Attach a file (images, PDFs, etc.)
- `./scripts/jira/jira.ts delete <issue-key>`

## Output Formats

- Default: Markdown
- JSON: Add `--json` flag

## Common Workflows

### View my assigned issues

```bash
./scripts/jira/jira.ts search "assignee = currentUser() AND status != Done ORDER BY priority DESC"
```

### Start working on an issue

```bash
./scripts/jira/jira.ts get PROJ-123
./scripts/jira/jira.ts transition PROJ-123 --to "In Progress"
./scripts/jira/jira.ts comment PROJ-123 --add "Starting work"
```

### Complete an issue

```bash
./scripts/jira/jira.ts comment PROJ-123 --add "Done"
./scripts/jira/jira.ts transition PROJ-123 --to "Done"
```

### Create a bug with details

```bash
./scripts/jira/jira.ts create --project PROJ --type Bug --summary "Login fails on Safari" \
  --description "Users cannot log in using Safari 17. Error: 'Invalid session'" \
  --priority High --labels safari,auth,urgent
```

### Create a subtask

```bash
./scripts/jira/jira.ts create --project PROJ --type Sub-task --summary "Write unit tests" \
  --parent PROJ-123
```

### Attach files to an issue

```bash
# Attach a screenshot
./scripts/jira/jira.ts attach PROJ-123 ./screenshot.png

# Attach multiple files
for f in ./audit/*.png; do
  ./scripts/jira/jira.ts attach PROJ-123 "$f"
done
```

### Search examples

```bash
# My open issues
./scripts/jira/jira.ts search "assignee = currentUser() AND status != Done"

# Recent bugs in project
./scripts/jira/jira.ts search "project = PROJ AND type = Bug ORDER BY created DESC" --limit 10

# Unassigned issues
./scripts/jira/jira.ts search "project = PROJ AND assignee IS EMPTY"

# Issues updated this week
./scripts/jira/jira.ts search "project = PROJ AND updated >= -7d"

# High priority blockers
./scripts/jira/jira.ts search "priority = Highest AND status != Done"
```

## Tips

- **Discover valid values first**: Run `transitions <key>` before transitioning, `types <project>` before creating
- **Use `--json` for scripting**: Pipe output to `jq` for automation
- **Quote JQL queries**: Always wrap JQL in double quotes to handle spaces

## Error Handling

- Errors print to stderr
- With `--json`: `{"error": "message"}`
- Exit codes: `0` success, `1` error
