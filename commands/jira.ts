import { error } from '../utils/output.ts';
import type { CustomFieldDef } from '../jira/lib/fields/codec-types.ts';

/**
 * Resolve a comma-separated `--show-field` argument into CustomFieldDef entries.
 * Returns undefined when the flag is absent. Resolution errors propagate.
 */
async function resolveShowFields(flag: string | undefined): Promise<CustomFieldDef[] | undefined> {
    if (!flag) return undefined;
    const names = flag
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    if (names.length === 0) return undefined;
    const { buildRegistry } = await import('../jira/lib/fields/registry.ts');
    const registry = await buildRegistry();
    return names.map(n => registry.resolve(n));
}

/**
 * Command options for Jira CLI
 */
interface JiraOptions {
    json?: boolean;
    project?: string;
    type?: string;
    summary?: string;
    description?: string;
    priority?: string;
    labels?: string;
    to?: string;
    add?: string;
    limit?: number;
    parent?: string;
    estimate?: string;
    remaining?: string;
    name?: string;
    'start-date'?: string;
    'release-date'?: string;
    released?: boolean;
    unreleased?: boolean;
    'fix-version'?: string;
    'affected-version'?: string;
    'move-fix-issues-to'?: string;
    'move-affected-issues-to'?: string;
    from?: string;
    url?: string;
    title?: string;
    remove?: string;
    field?: string[];
    'field-json'?: string;
    'show-field'?: string;
    refresh?: boolean;
    verbose?: boolean;
}

/**
 * Parse command-line arguments into subcommand, args, and options.
 */
function parseArgs(argv: string[]): {
    subcommand: string;
    args: string[];
    options: JiraOptions;
} {
    const args: string[] = [];
    const options: JiraOptions = {};

    let i = 0;
    while (i < argv.length) {
        const arg = argv[i];

        if (arg === '--json') {
            options.json = true;
        } else if (arg === '--released') {
            options.released = true;
        } else if (arg === '--unreleased') {
            options.unreleased = true;
        } else if (arg === '--refresh') {
            options.refresh = true;
        } else if (arg === '--verbose') {
            options.verbose = true;
        } else if (arg === '--field') {
            const value = argv[++i];
            if (value === undefined) {
                throw new Error(`Option ${arg} requires a value`);
            }
            (options.field ??= []).push(value);
        } else if (arg.startsWith('--')) {
            const key = arg.slice(2) as keyof JiraOptions;
            const value = argv[++i];
            if (value === undefined) {
                throw new Error(`Option ${arg} requires a value`);
            }
            if (key === 'limit') {
                options.limit = parseInt(value, 10);
            } else {
                (options as Record<string, string>)[key] = value;
            }
        } else {
            args.push(arg);
        }
        i++;
    }

    const subcommand = args[0] ?? '';
    return { subcommand, args: args.slice(1), options };
}

/**
 * Display Jira-specific help.
 */
function showJiraHelp(): void {
    console.log(`
Jira CLI - Manage Jira issues from the command line

USAGE:
  af jira <command> [arguments] [options]

COMMANDS:
  get <issue-key>           Get issue details
  list <project>            List issues in a project
  search "<jql>"            Search issues with JQL
  create                    Create a new issue
  update <issue-key>        Update an issue
  delete <issue-key>        Delete an issue
  comment <issue-key>       List or add comments
  attach <issue-key> <file> Attach a file to an issue
  transition <issue-key>    Change issue status
  transitions <issue-key>   List available transitions
  assign <issue-key>        Assign issue to a user
  projects                  List all projects
  types <project>           List issue types for a project
  fields                    List custom fields (discovery for --field flags)

LINK COMMANDS:
  link <issue-key>          Link two issues
  unlink <issue-key>        Remove a link between two issues
  remote-link <issue-key>   List, add, or remove remote links

VERSION COMMANDS:
  versions <project>        List all versions in a project
  version <version-id>      Get version details
  version-create            Create a new version
  version-update <id>       Update a version
  version-delete <id>       Delete a version

OPTIONS:
  --json                    Output as JSON instead of markdown
  --limit <n>               Limit results (default: 50)

LIST / SEARCH OPTIONS:
  --show-field <a,b,c>      Include named custom fields as extra columns
                            (names resolve like --field: alias / display name / id)

FIELDS OPTIONS:
  --project <key>           Restrict to fields available for a project
  --type <name>             Restrict to fields available for a project+issue-type
  --refresh                 Bust cache before fetching
  --verbose                 Include raw schema entries in output
  --json                    Output as JSON instead of markdown

CREATE OPTIONS:
  --project <key>           Project key (required)
  --type <name>             Issue type (required)
  --summary "<text>"        Summary (required)
  --description "<text>"    Description
  --priority <name>         Priority (e.g., High, Medium, Low)
  --labels <a,b,c>          Comma-separated labels
  --parent <issue-key>      Parent issue (for subtasks)
  --estimate <time>         Original estimate (e.g., "2h", "1d", "30m")
  --fix-version <v1,v2>     Fix version(s), comma-separated
  --affected-version <v>    Affected version(s), comma-separated
  --field <name>=<value>    Set a custom field (repeatable). Empty value clears.
                            Name resolves to alias, display name, or customfield_<id>.
  --field-json '<json>'     Merge a JSON object of custom fields into the request
                            (escape hatch for complex field types)

UPDATE OPTIONS:
  --summary "<text>"        New summary
  --description "<text>"    New description
  --priority <name>         New priority
  --labels <a,b,c>          New labels (replaces existing)
  --estimate <time>         Original estimate (e.g., "2h", "1d", "30m")
  --remaining <time>        Remaining estimate (e.g., "1h", "4h")
  --fix-version <v1,v2>     Fix version(s), comma-separated (empty to clear)
  --affected-version <v>    Affected version(s), comma-separated (empty to clear)
  --field <name>=<value>    Set a custom field (repeatable). Empty value clears it.
  --field-json '<json>'     Merge a JSON object of custom fields into the update

VERSION-CREATE OPTIONS:
  --project <key>           Project key (required)
  --name "<text>"           Version name (required)
  --description "<text>"    Description
  --start-date <YYYY-MM-DD> Start date
  --release-date <YYYY-MM-DD> Release date
  --released                Mark as released

VERSION-UPDATE OPTIONS:
  --name "<text>"           New version name
  --description "<text>"    New description
  --start-date <YYYY-MM-DD> New start date
  --release-date <YYYY-MM-DD> New release date
  --released                Mark as released
  --unreleased              Mark as unreleased

VERSION-DELETE OPTIONS:
  --move-fix-issues-to <id>      Move fix version issues to this version
  --move-affected-issues-to <id> Move affected version issues to this version

LINK OPTIONS:
  --to <issue-key>          Target issue key (required)
  --type <name>             Link type name (default: "Blocks")

UNLINK OPTIONS:
  --from <issue-key>        Target issue key to unlink (required)

REMOTE-LINK OPTIONS:
  --url "<url>"             Add a remote link (requires --title)
  --title "<text>"          Title for the remote link
  --remove <link-id>        Remove a remote link by ID

COMMENT OPTIONS:
  --add "<text>"            Add a comment (omit to list comments)

TRANSITION OPTIONS:
  --to "<status>"           Target status name (required)

ASSIGN OPTIONS:
  --to "<email>"            User email (use "none" to unassign)

EXAMPLES:
  af jira get PROJ-123
  af jira list PROJ --limit 20
  af jira list PROJ --show-field storyPoints,severity
  af jira search "assignee = currentUser() AND status != Done"
  af jira fields
  af jira fields --project PROJ --type Story
  af jira create --project PROJ --type Bug --summary "Login broken"
  af jira create --project PROJ --type Story --summary "X" --field storyPoints=5 --field severity=High
  af jira create --project PROJ --type Task --summary "Feature" --estimate "4h"
  af jira create --project PROJ --type Bug --summary "Bug" --fix-version "v1.0.0"
  af jira update PROJ-123 --field storyPoints=8
  af jira update PROJ-123 --field severity=
  af jira update PROJ-123 --summary "Updated title" --priority High
  af jira update PROJ-123 --estimate "8h" --remaining "2h"
  af jira update PROJ-123 --fix-version "v2.0.0" --affected-version "v1.0.0"
  af jira comment PROJ-123 --add "Working on this"
  af jira transition PROJ-123 --to "In Progress"
  af jira assign PROJ-123 --to user@example.com
  af jira link PROJ-123 --to PROJ-456
  af jira link PROJ-123 --to PROJ-456 --type "Relates"
  af jira unlink PROJ-123 --from PROJ-456
  af jira remote-link PROJ-123
  af jira remote-link PROJ-123 --url "https://example.com/doc" --title "Design Doc"
  af jira remote-link PROJ-123 --remove 10042
  af jira versions PROJ
  af jira version-create --project PROJ --name "v1.0.0" --release-date 2024-06-01
  af jira version-update 12345 --released
`);
}

/**
 * Handle the 'jira' command.
 * Routes to appropriate Jira subcommand handlers.
 *
 * @param args - Command arguments (excluding 'jira')
 * @returns Exit code (0 for success, 1 for error)
 */
export async function handleJira(args: string[]): Promise<number> {
    // Handle --help flag
    if (args.includes('--help') || args.includes('-h')) {
        showJiraHelp();
        return 0;
    }

    // Parse arguments
    let parsed: ReturnType<typeof parseArgs>;
    try {
        parsed = parseArgs(args);
    } catch (err) {
        error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        return 1;
    }

    const { subcommand, args: subArgs, options } = parsed;
    const json = options.json ?? false;

    // Show help if no subcommand
    if (!subcommand || subcommand === 'help') {
        showJiraHelp();
        return 0;
    }

    // Lazy load client and formatters only when needed
    const client = await import('../jira/lib/client.ts');
    const fmt = await import('../jira/lib/formatters.ts');

    try {
        switch (subcommand) {
            case 'get': {
                const issueKey = subArgs[0];
                if (!issueKey) {
                    error('Error: Issue key required. Usage: af jira get <issue-key>');
                    return 1;
                }
                const [issue, remoteLinks] = await Promise.all([
                    client.getIssue(issueKey),
                    client.getRemoteLinks(issueKey),
                ]);
                if (json) {
                    fmt.output({ ...issue, remoteLinks }, true);
                } else {
                    // Build registry so custom-field names/types are known for display.
                    // Only the ids present on the issue need entries.
                    const customFieldKeys = Object.keys(issue.fields).filter(k =>
                        k.startsWith('customfield_'),
                    );
                    let customFieldDefs: CustomFieldDef[] = [];
                    if (customFieldKeys.length > 0) {
                        try {
                            const { buildRegistry } =
                                await import('../jira/lib/fields/registry.ts');
                            const registry = await buildRegistry();
                            customFieldDefs = customFieldKeys.map(id => registry.resolve(id));
                        } catch {
                            // If registry build fails (e.g., offline), render without custom names.
                            customFieldDefs = customFieldKeys.map(id => ({
                                id,
                                name: id,
                                schemaType: 'unknown' as const,
                            }));
                        }
                    }
                    fmt.output(fmt.formatIssue(issue, remoteLinks, customFieldDefs), false);
                }
                break;
            }

            case 'list': {
                const projectKey = subArgs[0];
                if (!projectKey) {
                    error('Error: Project key required. Usage: af jira list <project>');
                    return 1;
                }
                const extras = await resolveShowFields(options['show-field']);
                const result = await client.listProjectIssues(projectKey, options.limit ?? 50);
                fmt.output(json ? result : fmt.formatIssueList(result, extras), json);
                break;
            }

            case 'search': {
                const jql = subArgs[0];
                if (!jql) {
                    error('Error: JQL query required. Usage: af jira search "<jql>"');
                    return 1;
                }
                const extras = await resolveShowFields(options['show-field']);
                const result = await client.searchIssues(jql, options.limit ?? 50);
                fmt.output(json ? result : fmt.formatIssueList(result, extras), json);
                break;
            }

            case 'create': {
                const { project, type, summary, description, priority, labels, parent, estimate } =
                    options;
                if (!project || !type || !summary) {
                    error('Error: --project, --type, and --summary are required');
                    console.error(
                        'Usage: af jira create --project PROJ --type Task --summary "Title"',
                    );
                    return 1;
                }
                const labelList = labels?.split(',').map(l => l.trim());
                const fixVersionList = options['fix-version']
                    ?.split(',')
                    .map(v => v.trim())
                    .filter(v => v);
                const affectedVersionList = options['affected-version']
                    ?.split(',')
                    .map(v => v.trim())
                    .filter(v => v);
                const { resolveFieldFlags } = await import('../jira/lib/fields/resolve-flags.ts');
                const resolved = await resolveFieldFlags({
                    fieldPairs: options.field,
                    fieldJson: options['field-json'],
                });
                const issue = await client.createIssue(
                    project,
                    type,
                    summary,
                    description,
                    priority,
                    labelList,
                    parent,
                    estimate,
                    fixVersionList,
                    affectedVersionList,
                    resolved?.customFields,
                );
                fmt.output(
                    json ? issue : fmt.formatSuccess(`Created issue ${fmt.issueLink(issue.key)}`),
                    json,
                );
                break;
            }

            case 'update': {
                const issueKey = subArgs[0];
                if (!issueKey) {
                    error('Error: Issue key required. Usage: af jira update <issue-key> [options]');
                    return 1;
                }
                const updates: Parameters<typeof client.updateIssue>[1] = {};
                if (options.summary !== undefined) updates.summary = options.summary;
                if (options.description !== undefined) updates.description = options.description;
                if (options.priority !== undefined) updates.priority = options.priority;
                if (options.labels !== undefined) {
                    updates.labels = options.labels.split(',').map(l => l.trim());
                }
                if (options.estimate !== undefined) updates.originalEstimate = options.estimate;
                if (options.remaining !== undefined) updates.remainingEstimate = options.remaining;
                if (options['fix-version'] !== undefined) {
                    updates.fixVersions = options['fix-version']
                        ? options['fix-version'].split(',').map(v => v.trim())
                        : [];
                }
                if (options['affected-version'] !== undefined) {
                    updates.affectedVersions = options['affected-version']
                        ? options['affected-version'].split(',').map(v => v.trim())
                        : [];
                }

                const { resolveFieldFlags: resolveUpdateFlags } =
                    await import('../jira/lib/fields/resolve-flags.ts');
                const resolvedUpdate = await resolveUpdateFlags({
                    fieldPairs: options.field,
                    fieldJson: options['field-json'],
                });
                if (resolvedUpdate) {
                    updates.customFields = resolvedUpdate.customFields;
                }

                if (Object.keys(updates).length === 0) {
                    error('Error: No update options provided');
                    console.error(
                        'Use --summary, --description, --priority, --labels, --estimate, --remaining, --fix-version, --affected-version, --field, or --field-json',
                    );
                    return 1;
                }

                await client.updateIssue(issueKey, updates);
                fmt.output(
                    json
                        ? { success: true, key: issueKey }
                        : fmt.formatSuccess(`Updated issue ${fmt.issueLink(issueKey)}`),
                    json,
                );
                break;
            }

            case 'delete': {
                const issueKey = subArgs[0];
                if (!issueKey) {
                    error('Error: Issue key required. Usage: af jira delete <issue-key>');
                    return 1;
                }
                await client.deleteIssue(issueKey);
                fmt.output(
                    json
                        ? { success: true, key: issueKey }
                        : fmt.formatSuccess(`Deleted issue ${fmt.issueLink(issueKey)}`),
                    json,
                );
                break;
            }

            case 'comment': {
                const issueKey = subArgs[0];
                if (!issueKey) {
                    error(
                        'Error: Issue key required. Usage: af jira comment <issue-key> [--add "text"]',
                    );
                    return 1;
                }
                if (options.add) {
                    const comment = await client.addComment(issueKey, options.add);
                    fmt.output(
                        json
                            ? comment
                            : fmt.formatSuccess(`Added comment to ${fmt.issueLink(issueKey)}`),
                        json,
                    );
                } else {
                    const comments = await client.getComments(issueKey);
                    fmt.output(json ? comments : fmt.formatComments(issueKey, comments), json);
                }
                break;
            }

            case 'transition': {
                const issueKey = subArgs[0];
                if (!issueKey || !options.to) {
                    error('Error: Issue key and --to required');
                    console.error('Usage: af jira transition <issue-key> --to "Status Name"');
                    return 1;
                }
                await client.transitionIssue(issueKey, options.to);
                fmt.output(
                    json
                        ? { success: true, key: issueKey, status: options.to }
                        : fmt.formatSuccess(
                              `Transitioned ${fmt.issueLink(issueKey)} to "${options.to}"`,
                          ),
                    json,
                );
                break;
            }

            case 'transitions': {
                const issueKey = subArgs[0];
                if (!issueKey) {
                    error('Error: Issue key required. Usage: af jira transitions <issue-key>');
                    return 1;
                }
                const { transitions } = await client.getTransitions(issueKey);
                fmt.output(json ? transitions : fmt.formatTransitions(issueKey, transitions), json);
                break;
            }

            case 'assign': {
                const issueKey = subArgs[0];
                if (!issueKey || !options.to) {
                    error('Error: Issue key and --to required');
                    console.error('Usage: af jira assign <issue-key> --to user@email.com');
                    return 1;
                }
                if (options.to.toLowerCase() === 'none') {
                    await client.unassignIssue(issueKey);
                    fmt.output(
                        json
                            ? { success: true, key: issueKey, assignee: null }
                            : fmt.formatSuccess(`Unassigned ${fmt.issueLink(issueKey)}`),
                        json,
                    );
                } else {
                    await client.assignIssue(issueKey, options.to);
                    fmt.output(
                        json
                            ? { success: true, key: issueKey, assignee: options.to }
                            : fmt.formatSuccess(
                                  `Assigned ${fmt.issueLink(issueKey)} to ${options.to}`,
                              ),
                        json,
                    );
                }
                break;
            }

            case 'attach': {
                const issueKey = subArgs[0];
                const filePath = subArgs[1];
                if (!issueKey || !filePath) {
                    error(
                        'Error: Issue key and file path required. Usage: af jira attach <issue-key> <file>',
                    );
                    return 1;
                }
                const attachments = await client.addAttachment(issueKey, filePath);
                fmt.output(json ? attachments : fmt.formatAttachments(issueKey, attachments), json);
                break;
            }

            case 'projects': {
                const projects = await client.getProjects();
                fmt.output(json ? projects : fmt.formatProjects(projects), json);
                break;
            }

            case 'types': {
                const projectKey = subArgs[0];
                if (!projectKey) {
                    error('Error: Project key required. Usage: af jira types <project>');
                    return 1;
                }
                const types = await client.getIssueTypes(projectKey);
                fmt.output(json ? types : fmt.formatIssueTypes(projectKey, types), json);
                break;
            }

            case 'versions': {
                const projectKey = subArgs[0];
                if (!projectKey) {
                    error('Error: Project key required. Usage: af jira versions <project>');
                    return 1;
                }
                const versions = await client.getProjectVersions(projectKey);
                fmt.output(json ? versions : fmt.formatVersions(projectKey, versions), json);
                break;
            }

            case 'version': {
                const versionId = subArgs[0];
                if (!versionId) {
                    error('Error: Version ID required. Usage: af jira version <version-id>');
                    return 1;
                }
                const version = await client.getVersion(versionId);
                fmt.output(json ? version : fmt.formatVersion(version), json);
                break;
            }

            case 'version-create': {
                const { project, name, description } = options;
                if (!project || !name) {
                    error('Error: --project and --name are required');
                    console.error('Usage: af jira version-create --project PROJ --name "v1.0.0"');
                    return 1;
                }
                const version = await client.createVersion(project, name, {
                    description,
                    startDate: options['start-date'],
                    releaseDate: options['release-date'],
                    released: options.released,
                });
                fmt.output(
                    json
                        ? version
                        : fmt.formatSuccess(`Created version ${version.name} (ID: ${version.id})`),
                    json,
                );
                break;
            }

            case 'version-update': {
                const versionId = subArgs[0];
                if (!versionId) {
                    error(
                        'Error: Version ID required. Usage: af jira version-update <version-id> [options]',
                    );
                    return 1;
                }
                const versionUpdates: Parameters<typeof client.updateVersion>[1] = {};
                if (options.name !== undefined) versionUpdates.name = options.name;
                if (options.description !== undefined)
                    versionUpdates.description = options.description;
                if (options['start-date'] !== undefined)
                    versionUpdates.startDate = options['start-date'];
                if (options['release-date'] !== undefined)
                    versionUpdates.releaseDate = options['release-date'];
                if (options.released) versionUpdates.released = true;
                if (options.unreleased) versionUpdates.released = false;

                if (Object.keys(versionUpdates).length === 0) {
                    error('Error: No update options provided');
                    console.error(
                        'Use --name, --description, --start-date, --release-date, --released, or --unreleased',
                    );
                    return 1;
                }

                const updatedVersion = await client.updateVersion(versionId, versionUpdates);
                fmt.output(
                    json
                        ? updatedVersion
                        : fmt.formatSuccess(`Updated version ${updatedVersion.name}`),
                    json,
                );
                break;
            }

            case 'version-delete': {
                const versionId = subArgs[0];
                if (!versionId) {
                    error('Error: Version ID required. Usage: af jira version-delete <version-id>');
                    return 1;
                }
                await client.deleteVersion(versionId, {
                    moveFixIssuesTo: options['move-fix-issues-to'],
                    moveAffectedIssuesTo: options['move-affected-issues-to'],
                });
                fmt.output(
                    json
                        ? { success: true, id: versionId }
                        : fmt.formatSuccess(`Deleted version ${versionId}`),
                    json,
                );
                break;
            }

            case 'link': {
                const issueKey = subArgs[0];
                if (!issueKey) {
                    error(
                        'Error: Issue key required. Usage: af jira link <issue-key> --to <target-key>',
                    );
                    return 1;
                }
                if (!options.to) {
                    error(
                        'Error: --to is required. Usage: af jira link <issue-key> --to <target-key>',
                    );
                    return 1;
                }
                const linkType = options.type ?? 'Blocks';
                await client.linkIssue(issueKey, linkType, options.to);
                fmt.output(
                    json
                        ? { success: true, from: issueKey, to: options.to, type: linkType }
                        : fmt.formatSuccess(
                              `Linked ${fmt.issueLink(issueKey)} → ${fmt.issueLink(options.to)} (${linkType})`,
                          ),
                    json,
                );
                break;
            }

            case 'unlink': {
                const issueKey = subArgs[0];
                if (!issueKey) {
                    error(
                        'Error: Issue key required. Usage: af jira unlink <issue-key> --from <target-key>',
                    );
                    return 1;
                }
                if (!options.from) {
                    error(
                        'Error: --from is required. Usage: af jira unlink <issue-key> --from <target-key>',
                    );
                    return 1;
                }
                const issue = await client.getIssue(issueKey);
                const targetKey = options.from;
                const matchingLink = issue.fields.issuelinks?.find(
                    il => il.outwardIssue?.key === targetKey || il.inwardIssue?.key === targetKey,
                );
                if (!matchingLink) {
                    throw new Error(`No link found between ${issueKey} and ${targetKey}`);
                }
                await client.unlinkIssue(matchingLink.id);
                fmt.output(
                    json
                        ? { success: true, from: issueKey, target: targetKey }
                        : fmt.formatSuccess(
                              `Unlinked ${fmt.issueLink(issueKey)} from ${fmt.issueLink(targetKey)}`,
                          ),
                    json,
                );
                break;
            }

            case 'remote-link': {
                const issueKey = subArgs[0];
                if (!issueKey) {
                    error(
                        'Error: Issue key required. Usage: af jira remote-link <issue-key> [--url "..." --title "..."] [--remove <id>]',
                    );
                    return 1;
                }
                if (options.url) {
                    if (!options.title) {
                        error('Error: --title is required when adding a remote link');
                        return 1;
                    }
                    await client.addRemoteLink(issueKey, options.url, options.title);
                    fmt.output(
                        json
                            ? {
                                  success: true,
                                  key: issueKey,
                                  url: options.url,
                                  title: options.title,
                              }
                            : fmt.formatSuccess(
                                  `Added remote link to ${fmt.issueLink(issueKey)}: ${options.title}`,
                              ),
                        json,
                    );
                } else if (options.remove) {
                    await client.removeRemoteLink(issueKey, options.remove);
                    fmt.output(
                        json
                            ? { success: true, key: issueKey, removedId: options.remove }
                            : fmt.formatSuccess(
                                  `Removed remote link ${options.remove} from ${fmt.issueLink(issueKey)}`,
                              ),
                        json,
                    );
                } else {
                    const links = await client.getRemoteLinks(issueKey);
                    fmt.output(json ? links : fmt.formatRemoteLinks(issueKey, links), json);
                }
                break;
            }

            case 'fields': {
                const { buildRegistry, fetchCreateMeta } =
                    await import('../jira/lib/fields/registry.ts');
                const registry = await buildRegistry({ refresh: options.refresh });
                const scoped = Boolean(options.project && options.type);
                if (scoped) {
                    const meta = await fetchCreateMeta(options.project!, options.type!, {
                        refresh: options.refresh,
                    });
                    registry.enrichWithCreateMeta(meta);
                }
                const entries = registry.all();
                if (json) {
                    fmt.output(entries, true);
                } else {
                    fmt.output(
                        fmt.formatFields(entries, { scoped, verbose: options.verbose }),
                        false,
                    );
                }
                break;
            }

            default:
                error(`Unknown jira command: ${subcommand}`);
                console.error("Run 'af jira --help' for usage information");
                return 1;
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (json) {
            console.error(JSON.stringify({ error: message }));
        } else {
            error(`Error: ${message}`);
        }
        return 1;
    }

    return 0;
}
