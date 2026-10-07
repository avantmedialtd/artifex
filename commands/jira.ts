import { error } from '../utils/output.ts';
import { checkStrictArgs, splitOptionToken, type StrictRule } from '../utils/cli-args.ts';
import {
    aliasedSource,
    assertSingleSource,
    readProse,
    type ProseSource,
} from '../utils/text-input.ts';
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
 * Parse repeatable `--field name=value` pairs into a raw fields object for a
 * transition screen. Values that parse as JSON are used as-is (so callers can
 * pass `{"id":"3"}` or `["a","b"]`); everything else is kept as a string.
 * Returns undefined when no pairs are present.
 */
function parseTransitionFields(pairs: string[] | undefined): Record<string, unknown> | undefined {
    if (!pairs || pairs.length === 0) return undefined;
    const fields: Record<string, unknown> = {};
    for (const pair of pairs) {
        const eq = pair.indexOf('=');
        if (eq === -1) {
            throw new Error(`Invalid --field "${pair}" (expected name=value)`);
        }
        const name = pair.slice(0, eq).trim();
        const raw = pair.slice(eq + 1);
        try {
            fields[name] = JSON.parse(raw);
        } catch {
            fields[name] = raw;
        }
    }
    return fields;
}

/**
 * Parse a `--visibility` value into a Jira visibility restriction. A `group:` or
 * `role:` prefix selects the type; the default is a project role.
 */
function parseVisibility(
    value: string | undefined,
): { type: 'group' | 'role'; value: string } | undefined {
    if (!value) return undefined;
    if (value.startsWith('group:')) return { type: 'group', value: value.slice(6) };
    if (value.startsWith('role:')) return { type: 'role', value: value.slice(5) };
    return { type: 'role', value };
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
    'description-file'?: string;
    priority?: string;
    labels?: string;
    to?: string;
    'to-project'?: string;
    resolution?: string;
    comment?: string;
    'comment-file'?: string;
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
    body?: string;
    'body-file'?: string;
    visibility?: string;
    'clear-parent'?: boolean;
    internal?: boolean;
    public?: boolean;
    jql?: string;
    time?: string;
    started?: string;
    above?: string;
    below?: string;
    sprint?: string;
    board?: string;
    state?: string;
}

// Options that take no value. Written with `=` (`--json=true`) they are an error.
const BOOLEAN_OPTIONS = new Set([
    '--json',
    '--released',
    '--unreleased',
    '--refresh',
    '--verbose',
    '--clear-parent',
    '--internal',
    '--public',
]);

// Each prose flag and its `-file` twin, which takes a path or `-` for stdin.
const BODY_PROSE = { inline: '--body', file: '--body-file' };
const DESCRIPTION_PROSE = { inline: '--description', file: '--description-file' };
const COMMENT_PROSE = { inline: '--comment', file: '--comment-file' };

function strictRule(
    command: string,
    options: string[],
    maxPositionals: number,
    prose?: StrictRule['prose'],
): StrictRule {
    // --json is the only global option.
    return {
        command: `af jira ${command}`,
        options: [...options, '--json'],
        maxPositionals,
        prose,
    };
}

/**
 * The subcommands that take prose reject unknown options and extra positional
 * arguments, which used to be ignored silently. `comment` and `worklog` rules
 * are keyed by their action; `maxPositionals` counts the arguments after the
 * subcommand (`comment edit KEY ID` has 3). Other subcommands stay lenient.
 */
const STRICT_RULES = new Map<string, StrictRule>(
    [
        strictRule(
            'comment',
            ['--body', '--body-file', '--add', '--visibility', '--internal', '--public'],
            1,
            BODY_PROSE,
        ),
        strictRule(
            'comment edit',
            ['--body', '--body-file', '--add', '--visibility'],
            3,
            BODY_PROSE,
        ),
        strictRule('comment delete', [], 3),
        strictRule(
            'create',
            [
                '--project',
                '--type',
                '--summary',
                '--description',
                '--description-file',
                '--priority',
                '--labels',
                '--parent',
                '--estimate',
                '--fix-version',
                '--affected-version',
                '--field',
                '--field-json',
            ],
            0,
            DESCRIPTION_PROSE,
        ),
        strictRule(
            'update',
            [
                '--summary',
                '--description',
                '--description-file',
                '--priority',
                '--labels',
                '--estimate',
                '--remaining',
                '--fix-version',
                '--affected-version',
                '--parent',
                '--clear-parent',
                '--field',
                '--field-json',
            ],
            1,
            DESCRIPTION_PROSE,
        ),
        strictRule(
            'transition',
            ['--to', '--resolution', '--comment', '--comment-file', '--field'],
            1,
            COMMENT_PROSE,
        ),
        strictRule('worklog list', [], 2),
        strictRule(
            'worklog add',
            ['--time', '--started', '--comment', '--comment-file'],
            2,
            COMMENT_PROSE,
        ),
        strictRule(
            'worklog update',
            ['--time', '--started', '--comment', '--comment-file'],
            3,
            COMMENT_PROSE,
        ),
        strictRule('worklog delete', [], 3),
        strictRule(
            'version-create',
            [
                '--project',
                '--name',
                '--description',
                '--description-file',
                '--start-date',
                '--release-date',
                '--released',
            ],
            0,
            DESCRIPTION_PROSE,
        ),
        strictRule(
            'version-update',
            [
                '--name',
                '--description',
                '--description-file',
                '--start-date',
                '--release-date',
                '--released',
                '--unreleased',
            ],
            1,
            DESCRIPTION_PROSE,
        ),
    ].map(rule => [rule.command, rule]),
);

/** The strict rule for a subcommand and its first positional argument, if any. */
function findStrictRule(subcommand: string, action: string | undefined): StrictRule | undefined {
    let key = subcommand;
    if (subcommand === 'comment') {
        // Anything other than edit or delete is an issue key: list or add.
        if (action === 'edit' || action === 'delete') key = `comment ${action}`;
    } else if (subcommand === 'worklog') {
        // Only the known actions have a rule, so an unknown action still gets
        // the handler's "requires an action" error.
        key = `worklog ${action}`;
    }
    return STRICT_RULES.get(`af jira ${key}`);
}

/**
 * Parse command-line arguments into subcommand, args, and options.
 *
 * An option takes its value from `--name=value` (split at the first `=`) or
 * from the next argument, whatever that argument looks like. `typedOptions`
 * lists the options as typed, without `=value`. Subcommands that take prose
 * are checked strictly at the end (see STRICT_RULES).
 */
export function parseArgs(argv: string[]): {
    subcommand: string;
    args: string[];
    options: JiraOptions;
    typedOptions: string[];
} {
    const args: string[] = [];
    const options: JiraOptions = {};
    const values = options as Record<string, unknown>;
    const typedOptions: string[] = [];
    // The last argument when it is an option that needs a value. Reported
    // after the strict check: on a strict subcommand an unknown option at the
    // end is an unknown option, not an option missing its value.
    let missingValue: string | undefined;

    let i = 0;
    while (i < argv.length) {
        const token = splitOptionToken(argv[i]);

        if (!token) {
            args.push(argv[i]);
        } else if (BOOLEAN_OPTIONS.has(token.flag)) {
            if (token.inlineValue !== undefined) {
                throw new Error(`Option ${token.flag} does not take a value`);
            }
            typedOptions.push(token.flag);
            values[token.flag.slice(2)] = true;
        } else {
            typedOptions.push(token.flag);
            const value = token.inlineValue ?? argv[++i];
            if (value === undefined) {
                // Only the last argument can lack a value, so the loop ends here.
                missingValue = token.flag;
                break;
            }
            const key = token.flag.slice(2);
            if (key === 'field') {
                (options.field ??= []).push(value);
            } else if (key === 'limit') {
                options.limit = parseInt(value, 10);
            } else {
                values[key] = value;
            }
        }
        i++;
    }

    const subcommand = args[0] ?? '';
    const subArgs = args.slice(1);
    const rule = findStrictRule(subcommand, subArgs[0]);
    if (rule) {
        checkStrictArgs(rule, typedOptions, subArgs);
    }
    if (missingValue !== undefined) {
        throw new Error(`Option ${missingValue} requires a value`);
    }
    return { subcommand, args: subArgs, options, typedOptions };
}

/** The comment body: `--body`, its alias `--add`, or `--body-file`. Throws on a conflict. */
function bodySource(options: JiraOptions): ProseSource {
    return aliasedSource(
        { flag: '--body', value: options.body },
        { flag: '--add', value: options.add },
        { flag: '--body-file', value: options['body-file'] },
    );
}

function descriptionSource(options: JiraOptions): ProseSource {
    return {
        flag: '--description',
        value: options.description,
        fileFlag: '--description-file',
        file: options['description-file'],
    };
}

function commentSource(options: JiraOptions): ProseSource {
    return {
        flag: '--comment',
        value: options.comment,
        fileFlag: '--comment-file',
        file: options['comment-file'],
    };
}

/** True when the inline flag or its file twin was given, even with an empty value. */
function isGiven(source: ProseSource): boolean {
    return source.value !== undefined || source.file !== undefined;
}

/**
 * Display the full Jira reference. `af jira --help` and `af help jira` print it too.
 */
export function showJiraHelp(): void {
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
  comment <issue-key>       List comments, or add one with --body / --body-file
  comment edit <key> <id>   Replace a comment's text (--body / --body-file)
  comment delete <key> <id> Delete a comment
  attach <issue-key> <file> Attach a file to an issue
  transition <issue-key>    Change issue status
  transitions <issue-key>   List available transitions
  assign <issue-key>        Assign issue to a user
  projects                  List all projects
  types <project>           List issue types for a project
  fields                    List custom fields (discovery for --field flags)
  editmeta <issue-key>      List editable fields for an issue
  move <issue-key>          Move issue to another project/type (async)
  bulk <action>             Bulk edit/transition/delete issues by JQL (async)
  worklog <action>          Log work: add/list/update/delete
  rank <issue-key>          Reorder in the backlog (--above/--below) [Jira Software]
  sprint <action>           Move issue into a sprint or to the backlog [Jira Software]
  boards                    List boards [Jira Software]
  sprints --board <id>      List a board's sprints [Jira Software]
  watch <issue-key>         Watch an issue (current user)
  unwatch <issue-key>       Stop watching an issue (current user)
  vote <issue-key>          Vote on an issue (current user)

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

  Options that take a value also accept --name=value. comment, create, update,
  transition, worklog, version-create and version-update reject options they
  do not know and extra arguments.

LIST / SEARCH OPTIONS:
  --limit <n>               Limit results (default: 50)
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
  --description "<text>"    Description (markdown, converted to ADF)
  --description-file <path|-> Read the description from a file, or from stdin with -
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
  --description "<text>"    New description (markdown, converted to ADF; "" clears it)
  --description-file <path|-> Read the new description from a file, or from stdin with -
  --priority <name>         New priority
  --labels <a,b,c>          New labels (replaces existing)
  --estimate <time>         Original estimate (e.g., "2h", "1d", "30m")
  --remaining <time>        Remaining estimate (e.g., "1h", "4h")
  --fix-version <v1,v2>     Fix version(s), comma-separated (empty to clear)
  --affected-version <v>    Affected version(s), comma-separated (empty to clear)
  --parent <issue-key>      Set the parent (subtask parent or epic)
  --clear-parent            Detach the parent (provisional; behavior varies by project)
  --field <name>=<value>    Set a custom field (repeatable). Empty value clears it.
  --field-json '<json>'     Merge a JSON object of custom fields into the update

VERSION-CREATE OPTIONS:
  --project <key>           Project key (required)
  --name "<text>"           Version name (required)
  --description "<text>"    Description (plain text, sent as typed)
  --description-file <path|-> Read the description from a file, or from stdin with -
  --start-date <YYYY-MM-DD> Start date
  --release-date <YYYY-MM-DD> Release date
  --released                Mark as released

VERSION-UPDATE OPTIONS:
  --name "<text>"           New version name
  --description "<text>"    New description (plain text, sent as typed; "" clears it)
  --description-file <path|-> Read the new description from a file, or from stdin with -
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
  --body "<text>"           Comment text, markdown converted to ADF (add and edit).
                            Without --body, --body-file or --add, 'comment <issue-key>'
                            lists the comments
  --body-file <path|->      Read the comment text from a file, or from stdin with -
  --add "<text>"            Alias of --body
  --visibility <name>       Restrict visibility (role by default; "group:Name" for a group)
  --internal                Add as a JSM internal note (Service Desk API)
  --public                  Add as a JSM public reply (Service Desk API)
                            With --internal or --public the text is sent as typed, and
                            Jira Service Management renders it as wiki markup, not markdown

TRANSITION OPTIONS:
  --to "<status>"           Target status name (required)
  --resolution <name>       Set the resolution (e.g., Fixed, "Won't Do")
  --comment "<text>"        Comment added with the transition (markdown, converted to ADF)
  --comment-file <path|->   Read the transition comment from a file, or from stdin with -
  --field <name>=<value>    Set a transition-screen field (repeatable; value may be JSON)

ASSIGN OPTIONS:
  --to "<email>"            User email (use "none" to unassign)

MOVE OPTIONS:
  --to-project <KEY>        Destination project key (required)
  --type <name>             Target issue type (defaults to the current type)

BULK OPTIONS:
  --jql "<query>"           Select issues to operate on (required)
  --to "<status>"           Target status (bulk transition; no-screen transitions only)
  --field-json '<json>'     editedFieldsInput payload (bulk edit)

WORKLOG OPTIONS:
  --time <duration>         Time spent, e.g. "2h", "30m" (required for add)
  --comment "<text>"        Worklog comment (markdown, converted to ADF)
  --comment-file <path|->   Read the worklog comment from a file, or from stdin with -
  --started "<timestamp>"   Start time (yyyy-MM-ddTHH:mm:ss.SSS+0000; defaults to now)

AGILE OPTIONS (Jira Software):
  --above <issue-key>       Rank the issue before this one (rank)
  --below <issue-key>       Rank the issue after this one (rank)
  --sprint <id>             Target sprint id (sprint add)
  --board <id>              Board id (sprints)
  --project <key>           Restrict boards to a project (boards)
  --state <s>               Sprint states, e.g. future,active,closed (sprints)

MULTI-LINE TEXT:
  Inside "double" or 'single' quotes, \\n stays a backslash and an n; it is never
  a newline. Double quotes also run \`commands\` and expand $VARS. For multi-line
  text, use a -file flag: pass a path, or - and a quoted heredoc (keep AF_BODY
  at the start of its line):

af jira comment PROJ-123 --body-file - <<'AF_BODY'
## Summary

- First point
AF_BODY

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
  af jira update PROJ-123 --description-file description.md
  af jira comment PROJ-123 --body "Working on this"
  af jira comment PROJ-123 --body-file notes.md
  af jira comment PROJ-123 --internal --body "Checked with the customer"
  af jira transition PROJ-123 --to "In Progress"
  af jira transition PROJ-123 --to Done --resolution Fixed --comment "Shipped in v1.2"
  af jira transitions PROJ-123
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
                const { project, type, summary, priority, labels, parent, estimate } = options;
                if (!project || !type || !summary) {
                    error('Error: --project, --type, and --summary are required');
                    console.error(
                        'Usage: af jira create --project PROJ --type Task --summary "Title"',
                    );
                    return 1;
                }
                // Command-line errors first, then the input, then any request.
                // An inline "" still means no description.
                const fieldFlags = { fieldPairs: options.field, fieldJson: options['field-json'] };
                const { resolveFieldFlags, validateFieldFlags } =
                    await import('../jira/lib/fields/resolve-flags.ts');
                validateFieldFlags(fieldFlags);
                const description = readProse(descriptionSource(options));
                const labelList = labels?.split(',').map(l => l.trim());
                const fixVersionList = options['fix-version']
                    ?.split(',')
                    .map(v => v.trim())
                    .filter(v => v);
                const affectedVersionList = options['affected-version']
                    ?.split(',')
                    .map(v => v.trim())
                    .filter(v => v);
                const resolved = await resolveFieldFlags(fieldFlags);
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
                const description = descriptionSource(options);
                assertSingleSource(description);
                const updates: Parameters<typeof client.updateIssue>[1] = {};
                if (options.summary !== undefined) updates.summary = options.summary;
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
                if (options['clear-parent']) {
                    updates.clearParent = true;
                } else if (options.parent !== undefined) {
                    updates.parent = options.parent;
                }

                // Decided by presence, before the description is read or the
                // custom fields are resolved over the network.
                const hasFieldFlags =
                    options.field !== undefined || options['field-json'] !== undefined;
                if (Object.keys(updates).length === 0 && !isGiven(description) && !hasFieldFlags) {
                    error('Error: No update options provided');
                    console.error(
                        'Use --summary, --description, --description-file, --priority, --labels, --estimate, --remaining, --fix-version, --affected-version, --parent, --clear-parent, --field, or --field-json',
                    );
                    return 1;
                }

                // A malformed --field or --field-json is reported before the
                // description is read. An inline "" is kept: it clears it.
                const updateFieldFlags = {
                    fieldPairs: options.field,
                    fieldJson: options['field-json'],
                };
                const { resolveFieldFlags: resolveUpdateFlags, validateFieldFlags } =
                    await import('../jira/lib/fields/resolve-flags.ts');
                validateFieldFlags(updateFieldFlags);
                const descriptionText = readProse(description);
                if (descriptionText !== undefined) updates.description = descriptionText;

                const resolvedUpdate = await resolveUpdateFlags(updateFieldFlags);
                if (resolvedUpdate) {
                    updates.customFields = resolvedUpdate.customFields;
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
                const action = subArgs[0];
                if (action === 'edit') {
                    const issueKey = subArgs[1];
                    const commentId = subArgs[2];
                    const body = bodySource(options);
                    if (!issueKey || !commentId || !isGiven(body)) {
                        error('Error: Issue key, comment id, and --body or --body-file required');
                        console.error(
                            'Usage: af jira comment edit <issue-key> <comment-id> --body "text" | --body-file -',
                        );
                        return 1;
                    }
                    // Given, so never undefined; an empty or blank body is an error.
                    const text = readProse(body, { required: true }) as string;
                    const comment = await client.updateComment(
                        issueKey,
                        commentId,
                        text,
                        parseVisibility(options.visibility),
                    );
                    fmt.output(
                        json
                            ? comment
                            : fmt.formatSuccess(
                                  `Updated comment ${commentId} on ${fmt.issueLink(issueKey)}`,
                              ),
                        json,
                    );
                    break;
                }
                if (action === 'delete') {
                    const issueKey = subArgs[1];
                    const commentId = subArgs[2];
                    if (!issueKey || !commentId) {
                        error('Error: Issue key and comment id required');
                        console.error('Usage: af jira comment delete <issue-key> <comment-id>');
                        return 1;
                    }
                    await client.deleteComment(issueKey, commentId);
                    fmt.output(
                        json
                            ? { success: true, key: issueKey, deletedId: commentId }
                            : fmt.formatSuccess(
                                  `Deleted comment ${commentId} from ${fmt.issueLink(issueKey)}`,
                              ),
                        json,
                    );
                    break;
                }

                const issueKey = action;
                if (!issueKey) {
                    error(
                        'Error: Issue key required. Usage: af jira comment <issue-key> [--body "text" | --body-file <path|->]',
                    );
                    return 1;
                }
                // Without a body flag the comments are listed. A given body must
                // not be empty, so `--add ""` fails instead of listing.
                const text = readProse(bodySource(options), { required: true });
                if (text === undefined) {
                    const comments = await client.getComments(issueKey);
                    fmt.output(json ? comments : fmt.formatComments(issueKey, comments), json);
                    break;
                }
                // JSM internal/public notes must go through the Service Desk API,
                // since the platform comment endpoint's public flag is read-only.
                // That API takes the text as typed and renders it as wiki markup.
                const comment =
                    options.internal || options.public
                        ? await client.addServiceDeskComment(
                              issueKey,
                              text,
                              Boolean(options.public),
                          )
                        : await client.addComment(
                              issueKey,
                              text,
                              parseVisibility(options.visibility),
                          );
                fmt.output(
                    json
                        ? comment
                        : fmt.formatSuccess(`Added comment to ${fmt.issueLink(issueKey)}`),
                    json,
                );
                break;
            }

            case 'transition': {
                const issueKey = subArgs[0];
                if (!issueKey || !options.to) {
                    error('Error: Issue key and --to required');
                    console.error('Usage: af jira transition <issue-key> --to "Status Name"');
                    return 1;
                }
                const fields = parseTransitionFields(options.field);
                // An inline "" still means no comment.
                const comment = readProse(commentSource(options));
                await client.transitionIssue(issueKey, options.to, {
                    resolution: options.resolution,
                    comment,
                    fields,
                });
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
                const { transitions } = await client.getTransitions(issueKey, {
                    expandFields: true,
                });
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
                const { project, name } = options;
                if (!project || !name) {
                    error('Error: --project and --name are required');
                    console.error('Usage: af jira version-create --project PROJ --name "v1.0.0"');
                    return 1;
                }
                // Version descriptions are plain text, sent as typed (no ADF).
                const description = readProse(descriptionSource(options));
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
                const versionDescription = descriptionSource(options);
                assertSingleSource(versionDescription);
                const versionUpdates: Parameters<typeof client.updateVersion>[1] = {};
                if (options.name !== undefined) versionUpdates.name = options.name;
                if (options['start-date'] !== undefined)
                    versionUpdates.startDate = options['start-date'];
                if (options['release-date'] !== undefined)
                    versionUpdates.releaseDate = options['release-date'];
                if (options.released) versionUpdates.released = true;
                if (options.unreleased) versionUpdates.released = false;

                if (Object.keys(versionUpdates).length === 0 && !isGiven(versionDescription)) {
                    error('Error: No update options provided');
                    console.error(
                        'Use --name, --description, --description-file, --start-date, --release-date, --released, or --unreleased',
                    );
                    return 1;
                }

                // Plain text, sent as typed; an inline "" clears the description.
                const descriptionText = readProse(versionDescription);
                if (descriptionText !== undefined) versionUpdates.description = descriptionText;

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

            case 'editmeta': {
                const issueKey = subArgs[0];
                if (!issueKey) {
                    error('Error: Issue key required. Usage: af jira editmeta <issue-key>');
                    return 1;
                }
                const meta = await client.getEditMeta(issueKey);
                fmt.output(json ? meta : fmt.formatEditMeta(issueKey, meta), json);
                break;
            }

            case 'move': {
                const issueKey = subArgs[0];
                const toProject = options['to-project'];
                if (!issueKey || !toProject) {
                    error('Error: Issue key and --to-project required');
                    console.error(
                        'Usage: af jira move <issue-key> --to-project <KEY> [--type <name>]',
                    );
                    return 1;
                }
                const task = await client.moveIssue(issueKey, toProject, { type: options.type });
                fmt.output(
                    json
                        ? { success: true, key: issueKey, toProject, type: options.type, task }
                        : fmt.formatSuccess(
                              `Moved ${fmt.issueLink(issueKey)} to ${toProject}` +
                                  `${options.type ? ` as ${options.type}` : ''} ` +
                                  `(task ${task.taskId}: ${task.status})`,
                          ),
                    json,
                );
                break;
            }

            case 'bulk': {
                const action = subArgs[0];
                if (!action || !['delete', 'transition', 'edit'].includes(action)) {
                    error('Error: bulk requires an action: delete | transition | edit');
                    console.error('Usage: af jira bulk <delete|transition|edit> --jql "<query>"');
                    return 1;
                }
                if (!options.jql) {
                    error('Error: --jql required');
                    console.error('Usage: af jira bulk <action> --jql "<query>"');
                    return 1;
                }
                const found = await client.searchIssues(options.jql, client.BULK_MAX_ISSUES);
                const keys = found.issues.map(i => i.key);
                if (keys.length === 0) {
                    fmt.output(
                        json
                            ? { matched: 0, tasks: [] }
                            : fmt.formatSuccess('No issues matched the JQL; nothing to do.'),
                        json,
                    );
                    break;
                }

                let tasks;
                if (action === 'delete') {
                    tasks = await client.runBulkOverKeys(keys, k => client.submitBulkDelete(k));
                } else if (action === 'transition') {
                    if (!options.to) {
                        error('Error: --to <status> required for bulk transition');
                        return 1;
                    }
                    // Resolve the transition on a sample issue and refuse if it needs a screen,
                    // since the bulk transition endpoint cannot supply field input.
                    const { transitions } = await client.getTransitions(keys[0], {
                        expandFields: true,
                    });
                    const t = transitions.find(
                        x => x.name.toLowerCase() === options.to!.toLowerCase(),
                    );
                    if (!t) {
                        const available = transitions.map(x => x.name).join(', ');
                        throw new Error(
                            `Transition "${options.to}" not found on ${keys[0]}. Available: ${available}`,
                        );
                    }
                    const required = Object.values(t.fields ?? {}).filter(f => f.required);
                    if (t.hasScreen || required.length > 0) {
                        error(
                            `Error: transition "${options.to}" presents a screen / required fields; bulk transition can't supply them.`,
                        );
                        console.error(
                            `Use single-issue: af jira transition <key> --to "${options.to}" --resolution ... --field ...`,
                        );
                        return 1;
                    }
                    tasks = await client.runBulkOverKeys(keys, k =>
                        client.submitBulkTransition(k, t.id),
                    );
                } else {
                    if (!options['field-json']) {
                        error("Error: bulk edit requires --field-json '<editedFieldsInput>'");
                        console.error(
                            'See the Jira bulk edit API for the editedFieldsInput shape.',
                        );
                        return 1;
                    }
                    let edited: Record<string, unknown>;
                    try {
                        edited = JSON.parse(options['field-json']);
                    } catch {
                        error('Error: --field-json must be valid JSON');
                        return 1;
                    }
                    tasks = await client.runBulkOverKeys(keys, k =>
                        client.submitBulkEdit(k, edited),
                    );
                }

                const allDone = tasks.every(t => t.status.toUpperCase().includes('COMPLETE'));
                fmt.output(
                    json
                        ? { matched: keys.length, chunks: tasks.length, tasks }
                        : fmt.formatSuccess(
                              `Bulk ${action} over ${keys.length} issue(s) in ${tasks.length} task(s): ` +
                                  `${allDone ? 'all complete' : 'see task statuses'}`,
                          ),
                    json,
                );
                break;
            }

            case 'worklog': {
                const action = subArgs[0];
                const issueKey = subArgs[1];
                if (action === 'list') {
                    if (!issueKey) {
                        error('Error: Issue key required. Usage: af jira worklog list <issue-key>');
                        return 1;
                    }
                    const worklogs = await client.getWorklogs(issueKey);
                    fmt.output(json ? worklogs : fmt.formatWorklogs(issueKey, worklogs), json);
                } else if (action === 'add') {
                    if (!issueKey || !options.time) {
                        error('Error: Issue key and --time required');
                        console.error(
                            'Usage: af jira worklog add <issue-key> --time 2h [--comment "..." | --comment-file <path|->]',
                        );
                        return 1;
                    }
                    // An inline "" still means no comment.
                    const comment = readProse(commentSource(options));
                    const wl = await client.addWorklog(issueKey, {
                        timeSpent: options.time,
                        started: options.started,
                        comment,
                    });
                    fmt.output(
                        json
                            ? wl
                            : fmt.formatSuccess(
                                  `Logged ${options.time} on ${fmt.issueLink(issueKey)} (worklog ${wl.id})`,
                              ),
                        json,
                    );
                } else if (action === 'update') {
                    const worklogId = subArgs[2];
                    if (!issueKey || !worklogId) {
                        error('Error: Issue key and worklog id required');
                        console.error(
                            'Usage: af jira worklog update <issue-key> <worklog-id> [--time 1h] [--comment "..." | --comment-file <path|->]',
                        );
                        return 1;
                    }
                    // An inline "" is sent and clears the comment.
                    const comment = readProse(commentSource(options));
                    const wl = await client.updateWorklog(issueKey, worklogId, {
                        timeSpent: options.time,
                        started: options.started,
                        comment,
                    });
                    fmt.output(
                        json
                            ? wl
                            : fmt.formatSuccess(
                                  `Updated worklog ${worklogId} on ${fmt.issueLink(issueKey)}`,
                              ),
                        json,
                    );
                } else if (action === 'delete') {
                    const worklogId = subArgs[2];
                    if (!issueKey || !worklogId) {
                        error('Error: Issue key and worklog id required');
                        console.error('Usage: af jira worklog delete <issue-key> <worklog-id>');
                        return 1;
                    }
                    await client.deleteWorklog(issueKey, worklogId);
                    fmt.output(
                        json
                            ? { success: true, key: issueKey, deletedId: worklogId }
                            : fmt.formatSuccess(
                                  `Deleted worklog ${worklogId} from ${fmt.issueLink(issueKey)}`,
                              ),
                        json,
                    );
                } else {
                    error('Error: worklog requires an action: add | list | update | delete');
                    console.error('Usage: af jira worklog <add|list|update|delete> <issue-key>');
                    return 1;
                }
                break;
            }

            case 'rank': {
                const issueKey = subArgs[0];
                if (!issueKey || (!options.above && !options.below)) {
                    error('Error: Issue key and --above or --below required');
                    console.error('Usage: af jira rank <issue-key> --above <key> | --below <key>');
                    return 1;
                }
                await client.rankIssue(issueKey, { above: options.above, below: options.below });
                const rel = options.above ? `above ${options.above}` : `below ${options.below}`;
                fmt.output(
                    json
                        ? {
                              success: true,
                              key: issueKey,
                              above: options.above,
                              below: options.below,
                          }
                        : fmt.formatSuccess(`Ranked ${fmt.issueLink(issueKey)} ${rel}`),
                    json,
                );
                break;
            }

            case 'sprint': {
                const action = subArgs[0];
                const issueKey = subArgs[1];
                if (action === 'add') {
                    if (!issueKey || !options.sprint) {
                        error('Error: Issue key and --sprint required');
                        console.error('Usage: af jira sprint add <issue-key> --sprint <sprint-id>');
                        return 1;
                    }
                    await client.moveIssueToSprint(options.sprint, issueKey);
                    fmt.output(
                        json
                            ? { success: true, key: issueKey, sprint: options.sprint }
                            : fmt.formatSuccess(
                                  `Added ${fmt.issueLink(issueKey)} to sprint ${options.sprint}`,
                              ),
                        json,
                    );
                } else if (action === 'remove') {
                    if (!issueKey) {
                        error(
                            'Error: Issue key required. Usage: af jira sprint remove <issue-key>',
                        );
                        return 1;
                    }
                    await client.moveIssueToBacklog(issueKey);
                    fmt.output(
                        json
                            ? { success: true, key: issueKey, sprint: null }
                            : fmt.formatSuccess(`Moved ${fmt.issueLink(issueKey)} to the backlog`),
                        json,
                    );
                } else {
                    error('Error: sprint requires an action: add | remove');
                    console.error('Usage: af jira sprint <add|remove> <issue-key> [--sprint <id>]');
                    return 1;
                }
                break;
            }

            case 'boards': {
                const boards = await client.getBoards({ projectKeyOrId: options.project });
                fmt.output(json ? boards : fmt.formatBoards(boards), json);
                break;
            }

            case 'sprints': {
                if (!options.board) {
                    error('Error: --board required. Usage: af jira sprints --board <board-id>');
                    return 1;
                }
                const sprints = await client.getSprints(options.board, { state: options.state });
                fmt.output(json ? sprints : fmt.formatSprints(options.board, sprints), json);
                break;
            }

            case 'watch':
            case 'unwatch':
            case 'vote': {
                const issueKey = subArgs[0];
                if (!issueKey) {
                    error(`Error: Issue key required. Usage: af jira ${subcommand} <issue-key>`);
                    return 1;
                }
                let message: string;
                if (subcommand === 'watch') {
                    await client.watchIssue(issueKey);
                    message = `Watching ${fmt.issueLink(issueKey)}`;
                } else if (subcommand === 'unwatch') {
                    await client.unwatchIssue(issueKey);
                    message = `Stopped watching ${fmt.issueLink(issueKey)}`;
                } else {
                    await client.voteIssue(issueKey);
                    message = `Voted on ${fmt.issueLink(issueKey)}`;
                }
                fmt.output(
                    json
                        ? { success: true, key: issueKey, action: subcommand }
                        : fmt.formatSuccess(message),
                    json,
                );
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
