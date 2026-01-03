import { error } from '../utils/output.ts';

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

OPTIONS:
  --json                    Output as JSON instead of markdown
  --limit <n>               Limit results (default: 50)

CREATE OPTIONS:
  --project <key>           Project key (required)
  --type <name>             Issue type (required)
  --summary "<text>"        Summary (required)
  --description "<text>"    Description
  --priority <name>         Priority (e.g., High, Medium, Low)
  --labels <a,b,c>          Comma-separated labels
  --parent <issue-key>      Parent issue (for subtasks)

UPDATE OPTIONS:
  --summary "<text>"        New summary
  --description "<text>"    New description
  --priority <name>         New priority
  --labels <a,b,c>          New labels (replaces existing)

COMMENT OPTIONS:
  --add "<text>"            Add a comment (omit to list comments)

TRANSITION OPTIONS:
  --to "<status>"           Target status name (required)

ASSIGN OPTIONS:
  --to "<email>"            User email (use "none" to unassign)

EXAMPLES:
  af jira get PROJ-123
  af jira list PROJ --limit 20
  af jira search "assignee = currentUser() AND status != Done"
  af jira create --project PROJ --type Bug --summary "Login broken"
  af jira update PROJ-123 --summary "Updated title" --priority High
  af jira comment PROJ-123 --add "Working on this"
  af jira transition PROJ-123 --to "In Progress"
  af jira assign PROJ-123 --to user@example.com
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
                const issue = await client.getIssue(issueKey);
                fmt.output(json ? issue : fmt.formatIssue(issue), json);
                break;
            }

            case 'list': {
                const projectKey = subArgs[0];
                if (!projectKey) {
                    error('Error: Project key required. Usage: af jira list <project>');
                    return 1;
                }
                const result = await client.listProjectIssues(projectKey, options.limit ?? 50);
                fmt.output(json ? result : fmt.formatIssueList(result), json);
                break;
            }

            case 'search': {
                const jql = subArgs[0];
                if (!jql) {
                    error('Error: JQL query required. Usage: af jira search "<jql>"');
                    return 1;
                }
                const result = await client.searchIssues(jql, options.limit ?? 50);
                fmt.output(json ? result : fmt.formatIssueList(result), json);
                break;
            }

            case 'create': {
                const { project, type, summary, description, priority, labels, parent } = options;
                if (!project || !type || !summary) {
                    error('Error: --project, --type, and --summary are required');
                    console.error(
                        'Usage: af jira create --project PROJ --type Task --summary "Title"',
                    );
                    return 1;
                }
                const labelList = labels?.split(',').map(l => l.trim());
                const issue = await client.createIssue(
                    project,
                    type,
                    summary,
                    description,
                    priority,
                    labelList,
                    parent,
                );
                fmt.output(json ? issue : fmt.formatSuccess(`Created issue ${issue.key}`), json);
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

                if (Object.keys(updates).length === 0) {
                    error('Error: No update options provided');
                    console.error('Use --summary, --description, --priority, or --labels');
                    return 1;
                }

                await client.updateIssue(issueKey, updates);
                fmt.output(
                    json
                        ? { success: true, key: issueKey }
                        : fmt.formatSuccess(`Updated issue ${issueKey}`),
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
                        : fmt.formatSuccess(`Deleted issue ${issueKey}`),
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
                        json ? comment : fmt.formatSuccess(`Added comment to ${issueKey}`),
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
                        : fmt.formatSuccess(`Transitioned ${issueKey} to "${options.to}"`),
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
                            : fmt.formatSuccess(`Unassigned ${issueKey}`),
                        json,
                    );
                } else {
                    await client.assignIssue(issueKey, options.to);
                    fmt.output(
                        json
                            ? { success: true, key: issueKey, assignee: options.to }
                            : fmt.formatSuccess(`Assigned ${issueKey} to ${options.to}`),
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
