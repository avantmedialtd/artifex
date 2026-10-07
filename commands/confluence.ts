import { checkStrictArgs, splitOptionToken, type StrictRule } from '../utils/cli-args.ts';
import { error } from '../utils/output.ts';
import {
    aliasedSource,
    assertSingleSource,
    readProse,
    type ProseSource,
} from '../utils/text-input.ts';

/**
 * Command options for Confluence CLI
 */
interface ConfluenceOptions {
    json?: boolean;
    space?: string;
    title?: string;
    body?: string;
    'body-file'?: string;
    parent?: string;
    status?: string;
    limit?: number;
    add?: string;
    remove?: string;
    message?: string;
}

// Global options, accepted by every subcommand. `--limit` is not one: only the
// listing subcommands read it.
const GLOBAL_OPTIONS = ['--json'];

// Every strict subcommand takes its prose from `--body` or `--body-file`.
const BODY_PROSE = { inline: '--body', file: '--body-file' };

// The subcommands that take prose reject unknown options and extra positional
// arguments, so a mistyped flag or an unquoted body fails instead of being
// ignored. Other subcommands keep the lenient parsing. `maxPositionals` counts
// the arguments after the subcommand.
const STRICT_RULES = new Map<string, StrictRule>([
    [
        'create',
        {
            command: 'af confluence create',
            options: [
                '--space',
                '--title',
                '--body',
                '--body-file',
                '--parent',
                '--status',
                ...GLOBAL_OPTIONS,
            ],
            maxPositionals: 0,
            prose: BODY_PROSE,
        },
    ],
    [
        'update',
        {
            command: 'af confluence update',
            options: [
                '--title',
                '--body',
                '--body-file',
                '--status',
                '--message',
                ...GLOBAL_OPTIONS,
            ],
            maxPositionals: 1,
            prose: BODY_PROSE,
        },
    ],
    [
        'comment',
        {
            command: 'af confluence comment',
            // `--add` is an alias of `--body` on `comment` only; on `label` it
            // names labels, so it is resolved in the handler, not here.
            options: ['--body', '--body-file', '--add', ...GLOBAL_OPTIONS],
            maxPositionals: 1,
            prose: BODY_PROSE,
        },
    ],
]);

/**
 * Parse command-line arguments into subcommand, args, and options.
 *
 * Options take their value from the next argument or, written as
 * `--name=value`, from the text after the first `=`. `--json` takes no value.
 * The subcommands in STRICT_RULES then reject options they do not accept and
 * extra positional arguments; the error message has no `Error: ` prefix.
 * An option such a subcommand does not take is reported as unknown even when
 * it is the last argument and has no value.
 */
export function parseArgs(argv: string[]): {
    subcommand: string;
    args: string[];
    options: ConfluenceOptions;
} {
    const args: string[] = [];
    const options: ConfluenceOptions = {};
    // Option names as typed, without `=value`, for the strict check.
    const typedOptions: string[] = [];
    // The last argument when it is an option that needs a value. Reported
    // after the strict check: on a strict subcommand `--internal` at the end is
    // an unknown option, not an option missing its value.
    let missingValue: string | undefined;

    let i = 0;
    while (i < argv.length) {
        const token = splitOptionToken(argv[i]);

        if (!token) {
            args.push(argv[i]);
        } else if (token.flag === '--json') {
            if (token.inlineValue !== undefined) {
                throw new Error(`Option ${token.flag} does not take a value`);
            }
            typedOptions.push(token.flag);
            options.json = true;
        } else {
            typedOptions.push(token.flag);
            const value = token.inlineValue ?? argv[++i];
            if (value === undefined) {
                // Only the last argument can lack a value, so the loop ends here.
                missingValue = token.flag;
                break;
            }
            const key = token.flag.slice(2);
            if (key === 'limit') {
                options.limit = parseInt(value, 10);
            } else {
                (options as Record<string, string>)[key] = value;
            }
        }
        i++;
    }

    const subcommand = args[0] ?? '';
    const positionals = args.slice(1);
    const rule = STRICT_RULES.get(subcommand);
    if (rule) {
        checkStrictArgs(rule, typedOptions, positionals);
    }
    if (missingValue !== undefined) {
        throw new Error(`Option ${missingValue} requires a value`);
    }
    return { subcommand, args: positionals, options };
}

/** The page body of `create` and `update`: `--body`, or `--body-file` (a path, or `-` for stdin). */
function pageBodySource(options: ConfluenceOptions): ProseSource {
    return {
        flag: '--body',
        value: options.body,
        fileFlag: '--body-file',
        file: options['body-file'],
    };
}

/**
 * Display Confluence-specific help.
 */
export function showConfluenceHelp(): void {
    console.log(`
Confluence CLI - Manage Confluence pages from the command line

USAGE:
  af confluence <command> [arguments] [options]

PAGE COMMANDS:
  get <page-id>              Get page content and metadata
  list <space-key>           List pages in a space
  search "<cql>"             Search with CQL (Confluence Query Language)
  create                     Create a new page
  update <page-id>           Update page content or metadata
  delete <page-id>           Delete a page
  tree <page-id>             Show page and its children

COMMENT COMMANDS:
  comments <page-id>         List comments on a page
  comment <page-id>          Add a comment

LABEL COMMANDS:
  labels <page-id>           List labels on a page
  label <page-id>            Add or remove labels

ATTACHMENT COMMANDS:
  attachments <page-id>      List attachments on a page
  attach <page-id> <file>    Upload an attachment

SPACE COMMANDS:
  spaces                     List all spaces
  space <space-key>          Get space details

OPTIONS:
  --json                     Output as JSON instead of markdown

  Options that take a value also accept --name=value. create, update and
  comment reject options they do not know and extra arguments.

LIST OPTIONS (list, search, tree, comments, labels, attachments, spaces):
  --limit <n>                Limit results (default: 50)

CREATE OPTIONS:
  --space <key>              Space key (required)
  --title "<text>"           Page title (required)
  --body "<text>"            Page body (markdown, converted to ADF)
  --body-file <path|->       Page body from a file, or - for stdin
                             (markdown, converted to ADF)
  --parent <page-id>         Parent page ID
  --status <draft|current>   Page status (default: current)

UPDATE OPTIONS:
  --title "<text>"           New page title
  --body "<text>"            New page body (markdown, converted to ADF)
  --body-file <path|->       New page body from a file, or - for stdin
                             (markdown, converted to ADF)
  --status <draft|current>   New page status
  --message "<text>"         Version message

COMMENT OPTIONS:
  --body "<text>"            Comment text (markdown, converted to ADF)
  --body-file <path|->       Comment text from a file, or - for stdin
                             (markdown, converted to ADF)
  --add "<text>"             Alias of --body

LABEL OPTIONS:
  --add "<name>"             Add a label
  --remove "<name>"          Remove a label

MULTI-LINE TEXT:
  Inside "double" or 'single' quotes, \\n stays a backslash and an n; it is never
  a newline. Double quotes also run \`commands\` and expand $VARS. For multi-line
  text, use a -file flag: pass a path, or - and a quoted heredoc (keep AF_BODY
  at the start of its line):

af confluence comment 12345 --body-file - <<'AF_BODY'
## Summary

- First point
AF_BODY

EXAMPLES:
  af confluence get 12345
  af confluence list MYSPACE --limit 20
  af confluence search "title = 'Meeting Notes'"
  af confluence create --space MYSPACE --title "New Page" --body "Hello world"
  af confluence create --space MYSPACE --title "From File" --body-file ./doc.md
  af confluence update 12345 --title "Updated Title"
  af confluence update 12345 --body-file ./updated.md --message "Revised content"
  af confluence delete 12345
  af confluence tree 12345
  af confluence comment 12345 --body "Great page!"
  af confluence label 12345 --add "important"
  af confluence label 12345 --remove "draft"
  af confluence attach 12345 ./diagram.png
  af confluence spaces
  af confluence space MYSPACE
`);
}

/**
 * Handle the 'confluence' command.
 * Routes to appropriate Confluence subcommand handlers.
 *
 * @param args - Command arguments (excluding 'confluence')
 * @returns Exit code (0 for success, 1 for error)
 */
export async function handleConfluence(args: string[]): Promise<number> {
    // Handle --help flag
    if (args.includes('--help') || args.includes('-h')) {
        showConfluenceHelp();
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
        showConfluenceHelp();
        return 0;
    }

    // Lazy load client and formatters only when needed
    const client = await import('../confluence/lib/client.ts');
    const fmt = await import('../confluence/lib/formatters.ts');

    try {
        switch (subcommand) {
            case 'get': {
                const pageId = subArgs[0];
                if (!pageId) {
                    error('Error: Page ID required. Usage: af confluence get <page-id>');
                    return 1;
                }
                const page = await client.getPage(pageId);
                fmt.output(json ? page : fmt.formatPage(page), json);
                break;
            }

            case 'list': {
                const spaceKey = subArgs[0];
                if (!spaceKey) {
                    error('Error: Space key required. Usage: af confluence list <space-key>');
                    return 1;
                }
                const result = await client.listPages(spaceKey, options.limit ?? 50);
                fmt.output(json ? result : fmt.formatPageList(result), json);
                break;
            }

            case 'search': {
                const cql = subArgs[0];
                if (!cql) {
                    error('Error: CQL query required. Usage: af confluence search "<cql>"');
                    return 1;
                }
                const result = await client.search(cql, options.limit ?? 50);
                fmt.output(json ? result : fmt.formatSearchResults(result), json);
                break;
            }

            case 'create': {
                const { space, title, parent, status } = options;
                if (!space || !title) {
                    error('Error: --space and --title are required');
                    console.error(
                        'Usage: af confluence create --space MYSPACE --title "Page Title" [--body "content" | --body-file <path|->]',
                    );
                    return 1;
                }
                // `--body ""` and no body at all both create an empty-bodied page.
                const body = readProse(pageBodySource(options));
                const pageStatus = status === 'draft' ? 'draft' : 'current';
                const page = await client.createPage(space, title, body ?? '', parent, pageStatus);
                fmt.output(
                    json
                        ? page
                        : fmt.formatSuccess(
                              `Created page ${fmt.pageLink(page.id, page.title, page._links?.webui)}`,
                          ),
                    json,
                );
                break;
            }

            case 'update': {
                const pageId = subArgs[0];
                if (!pageId) {
                    error(
                        'Error: Page ID required. Usage: af confluence update <page-id> [options]',
                    );
                    return 1;
                }
                const bodySource = pageBodySource(options);
                assertSingleSource(bodySource);
                // An inline `--body ""` leaves the page body unchanged, so it is
                // not an update option. `--body-file` is one as soon as it is
                // given: it is read only after this check.
                const bodyGiven = Boolean(options.body) || options['body-file'] !== undefined;
                if (!options.title && !bodyGiven && !options.status && !options.message) {
                    error('Error: No update options provided');
                    console.error('Use --title, --body, --body-file, --status, or --message');
                    return 1;
                }

                const body = readProse(bodySource);
                const updates: Parameters<typeof client.updatePage>[1] = {};
                if (options.title !== undefined) updates.title = options.title;
                if (body) updates.bodyMarkdown = body;
                if (options.status !== undefined)
                    updates.status = options.status as 'current' | 'draft';
                if (options.message !== undefined) updates.versionMessage = options.message;

                const page = await client.updatePage(pageId, updates);
                fmt.output(
                    json
                        ? page
                        : fmt.formatSuccess(
                              `Updated page ${fmt.pageLink(page.id, page.title, page._links?.webui)}`,
                          ),
                    json,
                );
                break;
            }

            case 'delete': {
                const pageId = subArgs[0];
                if (!pageId) {
                    error('Error: Page ID required. Usage: af confluence delete <page-id>');
                    return 1;
                }
                await client.deletePage(pageId);
                fmt.output(
                    json
                        ? { success: true, id: pageId }
                        : fmt.formatSuccess(`Deleted page ${pageId}`),
                    json,
                );
                break;
            }

            case 'tree': {
                const pageId = subArgs[0];
                if (!pageId) {
                    error('Error: Page ID required. Usage: af confluence tree <page-id>');
                    return 1;
                }
                const page = await client.getPage(pageId);
                const children = await client.getChildPages(pageId, options.limit ?? 50);
                fmt.output(
                    json
                        ? { page, children: children.results }
                        : fmt.formatPageTree(page, children.results),
                    json,
                );
                break;
            }

            case 'comments': {
                const pageId = subArgs[0];
                if (!pageId) {
                    error('Error: Page ID required. Usage: af confluence comments <page-id>');
                    return 1;
                }
                const comments = await client.getComments(pageId, options.limit ?? 50);
                fmt.output(json ? comments : fmt.formatComments(pageId, comments), json);
                break;
            }

            case 'comment': {
                const pageId = subArgs[0];
                if (!pageId) {
                    error(
                        'Error: Page ID required. Usage: af confluence comment <page-id> --body "text"',
                    );
                    return 1;
                }
                // `--add` is an alias of `--body` here; on `label` it names labels.
                const bodySource = aliasedSource(
                    { flag: '--body', value: options.body },
                    { flag: '--add', value: options.add },
                    { flag: '--body-file', value: options['body-file'] },
                );
                const body = readProse(bodySource, { required: true });
                if (body === undefined) {
                    error(
                        'Error: --body or --body-file required. Usage: af confluence comment <page-id> --body "text"',
                    );
                    return 1;
                }
                const comment = await client.addComment(pageId, body);
                fmt.output(
                    json ? comment : fmt.formatSuccess(`Added comment to page ${pageId}`),
                    json,
                );
                break;
            }

            case 'labels': {
                const pageId = subArgs[0];
                if (!pageId) {
                    error('Error: Page ID required. Usage: af confluence labels <page-id>');
                    return 1;
                }
                const labels = await client.getLabels(pageId, options.limit ?? 50);
                fmt.output(json ? labels : fmt.formatLabels(pageId, labels), json);
                break;
            }

            case 'label': {
                const pageId = subArgs[0];
                if (!pageId || (!options.add && !options.remove)) {
                    error(
                        'Error: Page ID and --add or --remove required. Usage: af confluence label <page-id> --add "name"',
                    );
                    return 1;
                }
                if (options.add) {
                    const labelNames = options.add.split(',').map(l => l.trim());
                    const labels = await client.addLabels(pageId, labelNames);
                    fmt.output(
                        json
                            ? labels
                            : fmt.formatSuccess(
                                  `Added label(s) ${labelNames.join(', ')} to page ${pageId}`,
                              ),
                        json,
                    );
                } else if (options.remove) {
                    await client.removeLabel(pageId, options.remove);
                    fmt.output(
                        json
                            ? { success: true, pageId, removed: options.remove }
                            : fmt.formatSuccess(
                                  `Removed label "${options.remove}" from page ${pageId}`,
                              ),
                        json,
                    );
                }
                break;
            }

            case 'attachments': {
                const pageId = subArgs[0];
                if (!pageId) {
                    error('Error: Page ID required. Usage: af confluence attachments <page-id>');
                    return 1;
                }
                const attachments = await client.getAttachments(pageId, options.limit ?? 50);
                fmt.output(json ? attachments : fmt.formatAttachments(pageId, attachments), json);
                break;
            }

            case 'attach': {
                const pageId = subArgs[0];
                const filePath = subArgs[1];
                if (!pageId || !filePath) {
                    error(
                        'Error: Page ID and file path required. Usage: af confluence attach <page-id> <file>',
                    );
                    return 1;
                }
                const result = await client.addAttachment(pageId, filePath);
                fmt.output(
                    json
                        ? result
                        : fmt.formatSuccess(
                              `Attached ${result.results.length} file(s) to page ${pageId}`,
                          ),
                    json,
                );
                break;
            }

            case 'spaces': {
                const spaces = await client.listSpaces(options.limit ?? 50);
                fmt.output(json ? spaces : fmt.formatSpaces(spaces), json);
                break;
            }

            case 'space': {
                const spaceKey = subArgs[0];
                if (!spaceKey) {
                    error('Error: Space key required. Usage: af confluence space <space-key>');
                    return 1;
                }
                const space = await client.getSpaceByKey(spaceKey);
                fmt.output(json ? space : fmt.formatSpace(space), json);
                break;
            }

            default:
                error(`Unknown confluence command: ${subcommand}`);
                console.error("Run 'af confluence --help' for usage information");
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
