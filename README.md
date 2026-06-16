# Artifex

**`af`** is a command-line tool for driving the services you already use — **Jira, Confluence, Bitbucket, SonarQube, and Jenkins** — straight from the terminal, alongside the local dev chores that surround them (dependency upgrades, OpenSpec changes, git worktrees, E2E runs).

Every command is non-interactive, scriptable, and speaks structured JSON — which makes `af` especially effective as a tool surface for **AI coding agents** (Claude Code and friends). One consistent CLI lets an agent read and act on your real systems: triage a Jira issue, read a Bitbucket PR diff, resolve review comments, check a SonarQube gate, or tail a Jenkins build — without a browser in the loop.

> **Note:** Artifex is in active development. Commands and flags may change as the project evolves.

## Why Artifex

- **One CLI, many services** — Jira, Confluence, Bitbucket, SonarQube and Jenkins behind a single `af` command with consistent verbs (`get` / `list` / `search` / `create` / `update`).
- **Agent-friendly by design** — non-interactive, deterministic, and `--json` on most commands, so an AI agent can parse output and chain calls instead of clicking through web UIs.
- **One auth surface** — credentials come from environment variables (or a `.env` file); no per-command login dance.
- **Fast** — runs TypeScript directly via the bundled [Bun](https://bun.sh) runtime, no build step.
- **Workflow-aware** — first-class support for the OpenSpec change workflow plus git worktree and release automation helpers.

## Installation

### Prerequisites

- [Node.js](https://nodejs.org) 16 or higher

The [Bun](https://bun.sh) runtime ships as a bundled dependency and is installed automatically — you do **not** need to install Bun separately to run `af`.

### Install from npm

```bash
npm install -g @avantmedia/af
```

The `af` command is then available globally.

### Install from source

For contributors working on Artifex itself (this path needs Bun installed locally for tests and formatting):

```bash
git clone https://github.com/avantmedialtd/artifex.git
cd artifex
bun install
bun link
```

`af` runs on macOS, Linux, and Windows.

## Authentication & configuration

Service commands read their credentials from environment variables. Export them in your shell or drop them in a `.env` file in your project directory — Bun loads `.env` automatically.

### Atlassian (Jira + Confluence)

```bash
ATLASSIAN_BASE_URL=https://your-domain.atlassian.net
ATLASSIAN_EMAIL=you@example.com
ATLASSIAN_API_TOKEN=your-api-token
```

Legacy `JIRA_BASE_URL` / `JIRA_EMAIL` / `JIRA_API_TOKEN` are accepted as fallbacks; when both are set, `ATLASSIAN_*` wins. Generate an API token at <https://id.atlassian.com/manage-profile/security/api-tokens>.

### Bitbucket Cloud

Bitbucket uses **separate** credentials — an Atlassian token scoped for Jira does **not** authenticate against Bitbucket Cloud.

```bash
BITBUCKET_USERNAME=your-bitbucket-username   # falls back to ATLASSIAN_EMAIL / JIRA_EMAIL
BITBUCKET_API_TOKEN=your-workspace-api-token # BITBUCKET_APP_PASSWORD also accepted (legacy)
```

Create a workspace API token at `https://bitbucket.org/<workspace>/workspace/settings/api-tokens` (recommended for automation) or an app password at <https://bitbucket.org/account/settings/app-passwords/>.

### SonarQube

```bash
SONAR_TOKEN=your-user-token        # required
SONAR_BASE_URL=https://sonar.example.com   # optional; falls back to sonar.host.url
                                            # in sonar-project.properties
```

### Jenkins

```bash
JENKINS_BASE_URL=https://jenkins.example.com
JENKINS_USER=your-username
JENKINS_API_TOKEN=your-api-token
```

### `af.json` (per-project settings)

Optional project-level config lives in an `af.json` at the repo root:

```json
{
    "bitbucket": { "workspace": "myws", "repo": "myrepo" },
    "jira": {
        "customFields": {
            "storyPoints": { "id": "customfield_10016" },
            "sprint": { "id": "customfield_10020", "type": "sprint" }
        }
    },
    "stopHook": {
        "ignoredPaths": ["openspec/", "docs/"],
        "command": "npm run test:e2e"
    }
}
```

For Bitbucket, the workspace/repo are resolved from `--workspace`/`--repo` flags first, then `af.json`, then the git `origin` remote if it points at `bitbucket.org`.

## Commands

Run `af help` for the full list, or `af help <command>` for details on any one. Many read commands accept `--json` for structured, machine-readable output.

### Jira

Manage issues end-to-end, including custom fields, workflow transitions, moves,
worklogs, and (for Jira Software) ranking and sprints.

```bash
af jira get PROJ-123                       # Issue details (renders custom fields when present)
af jira list PROJ --limit 20               # List project issues
af jira list PROJ --show-field storyPoints # Add custom-field columns
af jira search "status = Open AND assignee = currentUser()"
af jira create --project PROJ --type Bug --summary "Title" --field storyPoints=5
af jira update PROJ-123 --field storyPoints=8
af jira update PROJ-123 --parent PROJ-100   # Reparent / set epic
af jira link PROJ-123 --to PROJ-456 --type "Blocks"
af jira fields --project PROJ --type Story  # Required + allowed values for create
af jira editmeta PROJ-123                   # Editable fields for an existing issue
af jira projects                            # List visible projects
```

**Workflow transitions** carry resolution, comment, and screen fields — so an
agent can close an issue _correctly_ instead of leaving it resolved with no
resolution:

```bash
af jira transitions PROJ-123                                 # Lists transitions + which need a screen
af jira transition PROJ-123 --to Done --resolution Fixed --comment "Shipped in v1.2"
```

**Comments, worklogs, watching, voting:**

```bash
af jira comment PROJ-123 --add "Note" --visibility "Administrators"
af jira comment edit PROJ-123 10042 --body "Edited"
af jira comment delete PROJ-123 10042
af jira worklog add PROJ-123 --time 2h --comment "Investigated root cause"
af jira worklog list PROJ-123
af jira watch PROJ-123      # unwatch / vote likewise
```

**Move** an issue across projects/types (asynchronous bulk API — polled to
completion), and **bulk** operate over a JQL selection:

```bash
af jira move PROJ-123 --to-project NEWPROJ --type Story
af jira bulk transition --jql "project = PROJ AND status = Backlog" --to "To Do"
af jira bulk delete --jql "project = SCRATCH AND created < -90d"
```

**Jira Software** ranking and sprints:

```bash
af jira rank PROJ-123 --above PROJ-99       # Reorder in the backlog
af jira boards --project PROJ
af jira sprints --board 7 --state active
af jira sprint add PROJ-123 --sprint 42     # sprint remove moves it to the backlog
```

Every subcommand supports `--json` for scripting. Run `af jira --help` for the
full command and flag reference.

### Confluence

Full page CRUD plus search, hierarchy, comments, labels, and attachments.

```bash
af confluence get 12345                    # Page content
af confluence list MYSPACE --limit 20      # Pages in a space
af confluence search "title ~ 'Runbook'"   # CQL search
af confluence create --space MYSPACE --title "New Page" --body-file ./doc.md
af confluence update 12345 --body-file ./updated.md
af confluence tree 12345                   # Page hierarchy
af confluence comment 12345 --add "Looks good"
af confluence attach 12345 ./diagram.png
af confluence spaces                        # List all spaces
```

### Bitbucket (`af bb`)

Pull requests, review comments, tasks, and pipelines on Bitbucket Cloud, plus a read-only surface for inspecting repos, refs, commits, source, and PR gate state. `af bb` is a shorthand alias for `af bitbucket`.

```bash
# Pull requests
af bb pr list --state OPEN --mine
af bb pr get 42                            af bb pr diff 42
af bb pr create --title "Fix bug" --source feature/x --destination main \
    --reviewers abc123,def456 --description-file ./pr.md
af bb pr approve 42                        af bb pr merge 42 --strategy squash

# Review comments — inline, replies, and resolution
af bb pr comment add 42 --body "Please rename" --file src/app.ts --line 10
af bb pr comment add 42 --body "Done" --reply-to 100
af bb pr comment resolve 42 100            af bb pr comment reopen 42 100

# Tasks — standalone or anchored to a comment
af bb pr task add 42 --body "Add a test" --on-comment 100
af bb pr task update 42 7 --resolved

# PR review/gate state (read-only)
af bb pr activity 42                       af bb pr reviewers 42 --pending
af bb pr status 42                         # build/commit statuses — "is it green?"

# Pipelines
af bb pipeline list --branch main
af bb pipeline trigger --branch main --custom nightly --var FOO=bar
af bb pipeline logs <pipeline-uuid> <step-uuid> --follow

# Read the remote without a clone (all read-only, all support --json)
af bb whoami                               # Authenticated account + account id
af bb repo list --sort -updated_on         af bb repo get
af bb branch list                          af bb tag list
af bb commit list --branch main --limit 5  af bb commit get <sha> --diff
af bb src read README.md --ref main        af bb src ls src --recursive
af bb diff main..feature --stat            # diff/diffstat for any revspec

# Reviewers must be account IDs — look them up:
af bb members --query alice
```

### SonarQube

Read-only quality-gate visibility, shaped to pair with `af bb pr` (the same numeric PR id identifies both sides). The project key is read from `sonar-project.properties` (or `--project`).

```bash
af sonar pr 42                # Gate + top new issues + measures for PR 42
af sonar pr                   # Auto-detect the PR from the current branch
af sonar pr 42 --issues       # Full new-issues list
af sonar gate                 # Main-branch quality gate
af sonar prs                  # PRs SonarQube has analyzed
```

`af sonar pr` and `af sonar gate` exit non-zero when the gate status is `ERROR`, so they slot into CI and scripts.

### Jenkins

Read-only build visibility.

```bash
af jenkins jobs                          # List all jobs
af jenkins branches my-pipeline          # Per-branch build statuses
af jenkins build my-app/main             # Latest build info
af jenkins log my-app/main               # Latest build console output
af jenkins stages my-app/main            # Pipeline stage breakdown
af jenkins stage-log my-app/main "Test"  # Log for a specific stage
af jenkins queue                         # Show the build queue
```

### OpenSpec workflow

Helpers for the OpenSpec spec-driven change workflow.

```bash
af changes      # List all active OpenSpec changes
af todo         # Show every TODO from active changes, with progress bars
af watch        # Live-updating TODO dashboard (idle indicator after 60s)
```

A companion **VSCode extension** surfaces the same tasks in a dedicated panel — see [VSCode Extension](#vscode-extension).

### Local dev utilities

```bash
af npm upgrade                 # Upgrade all npm dependencies to latest (preserves range symbols)
af bun upgrade                 # Same, via Bun
af worktree new feature-x      # Create a git worktree (copies env files); --detach for detached HEAD
af worktree reset [name]       # Reset a worktree to HEAD
af versions reset              # Reset all vN version worktrees to HEAD
af versions push               # Force-push all vN version worktrees
af e2e [args...]               # Run E2E tests in a fresh Docker environment
af stop-hook                   # Run e2e only when relevant source files changed (Claude Code Stop hook)
```

The `af stop-hook` command is designed as a Claude Code **Stop hook**: it inspects the git diff and skips the (slow) E2E run when only ignored paths (e.g. `openspec/`) changed. Configure it via the `stopHook` block in `af.json`.

## VSCode Extension

For VSCode users, Artifex includes an extension that displays OpenSpec tasks in a dedicated panel (like the Problems panel), with progress badges and live refresh on `tasks.md` changes.

```bash
cd vscode-extension
npm install && npm run compile
# Press F5 in VSCode for an Extension Development Host, or `vsce package` to build a .vsix
```

The panel appears automatically in any workspace containing an `openspec/changes/` directory. See [vscode-extension/README.md](vscode-extension/README.md) for details.

## Releasing

Releases are automated and tag-driven. The package publishes as `@avantmedia/af` on the public npm registry, shipping TypeScript source that Bun executes natively (no build step).

1. On `master`, run the **`/release`** command. It picks the version bump, synthesizes curated notes in `releases/<tag>.md` from the OpenSpec changes that shipped, asks for approval, then bumps `package.json`, commits, tags `v<version>`, and pushes.
2. The `v*` tag push triggers `.github/workflows/release.yml`, which runs the CI gates and then `npm publish --provenance --access public` and creates the GitHub Release from the notes file.

`package.json`'s `version` is the source of truth — the workflow refuses to publish a tag whose value disagrees with it. To bump by hand: `bun run bump <patch|minor|major|x.y.z>` (`--dry-run` previews).

**One-time setup:** the workflow authenticates with the `NPM_TOKEN` repository secret — an npm granular access token scoped to `@avantmedia/af` (read + write). Create it at npmjs.com and run `gh secret set NPM_TOKEN -R avantmedialtd/artifex`.

The `files` allowlist in `package.json` controls the published tarball; test files, OpenSpec artifacts, the VSCode extension, and release tooling are excluded.

## Development

```bash
git clone https://github.com/avantmedialtd/artifex.git
cd artifex
bun install
bun link

# Tests (always `bun run test`, never `bun test` — this project uses Vitest)
bun run test
bun run test:watch
bun run test:coverage

# Formatting & linting
bun run format          # Prettier: 4-space, 100-width, single quotes
bun run format:check
bun run lint            # OXLint
bun run spell:check     # CSpell
```

### Git hooks

A pre-push hook that runs lint, spell, and format checks:

```bash
printf '#!/bin/sh\nbun run lint && bun run spell:check && bun run format:check\n' > .git/hooks/pre-push && chmod +x .git/hooks/pre-push
```

### Adding a command

Each command is a self-contained handler in `commands/`, wired up in `router.ts`, with help text in `commands/help.ts` and colocated `*.test.ts` tests. See [CLAUDE.md](CLAUDE.md) for the architecture and contributor guidelines.

## Bug Reports and Feature Requests

- **Report bugs / request features:** [GitHub Issues](https://github.com/avantmedialtd/artifex/issues)

When reporting a bug, please include your OS and Node.js version, steps to reproduce, expected vs. actual behavior, and any error output.

## Contributing

Contributions are welcome — bug fixes, features, or docs.

1. Check existing [issues](https://github.com/avantmedialtd/artifex/issues) or open a new one
2. Fork and create a feature branch
3. Make your changes and add tests
4. Ensure `bun run test`, `bun run lint`, `bun run spell:check`, and `bun run format:check` pass
5. Commit and open a pull request

## License

MIT License. See [LICENSE](LICENSE) for details.

## Author

István Antal <istvan@antal.xyz>

## Links

- [GitHub Repository](https://github.com/avantmedialtd/artifex)
- [Issue Tracker](https://github.com/avantmedialtd/artifex/issues)
