import type {
    BitbucketPullRequest,
    BitbucketPullRequestState,
    PullRequestSignals,
} from '../bitbucket/lib/types.ts';
import { checkStrictArgs, splitOptionToken, type StrictRule } from '../utils/cli-args.ts';
import { error } from '../utils/output.ts';
import { assertSingleSource, readProse, type ProseSource } from '../utils/text-input.ts';
import {
    filterCommentsByResolution,
    filterTasksByResolution,
    resolutionFilterFromFlags,
} from '../bitbucket/lib/filters.ts';
import { groupSignalFailures } from '../bitbucket/lib/signals.ts';

interface BitbucketOptions {
    json?: boolean;
    workspace?: string;
    repo?: string;

    // PR create/update
    title?: string;
    description?: string;
    'description-file'?: string;
    from?: string;
    to?: string;
    reviewers?: string;
    draft?: boolean;

    // PR list filters
    state?: string;
    mine?: boolean;
    author?: string;
    /** `pr list` / `pr mine`: add the Builds and Conflicts columns for open PRs. */
    checks?: boolean;

    // PR merge
    strategy?: string;
    'close-source'?: boolean;

    // Pipeline filters
    status?: string;

    // Comments / tasks
    body?: string;
    'body-file'?: string;
    file?: string;
    line?: number;
    'reply-to'?: number;
    'on-comment'?: number;
    resolved?: boolean;
    unresolved?: boolean;

    // Pipelines
    branch?: string;
    commit?: string;
    custom?: string;
    var?: string[];
    follow?: boolean;

    // Members / repo list
    query?: string;
    role?: string;
    sort?: string;

    // Commits / source / diff
    include?: string[];
    exclude?: string[];
    limit?: number;
    ref?: string;
    recursive?: boolean;
    diff?: boolean;
    diffstat?: boolean;
    patch?: boolean;
    stat?: boolean;

    // PR reviewers
    pending?: boolean;
}

const BOOLEAN_FLAGS = new Set([
    '--json',
    '--draft',
    '--mine',
    '--checks',
    '--close-source',
    '--resolved',
    '--unresolved',
    '--follow',
    '--recursive',
    '--diff',
    '--diffstat',
    '--patch',
    '--stat',
    '--pending',
]);

const NUMBER_FLAGS = new Set(['--line', '--reply-to', '--on-comment', '--limit']);

const REPEATABLE_FLAGS = new Set(['--var', '--include', '--exclude']);

// Flag aliases normalized at parse time so the rest of the handler only sees
// canonical keys (`from`, `to`, ...). Last-write-wins between any canonical
// and any alias falls out of the generic `--key value` branch below.
const FLAG_ALIASES = new Map<string, string>([
    ['--source', '--from'],
    ['--src', '--from'],
    ['--destination', '--to'],
    ['--dest', '--to'],
]);

// The pull request commands that take prose reject unknown options and extra
// positional arguments, so a mistyped flag or an unquoted body fails instead of
// being ignored. Every action of `pr comment` and `pr task` is covered.
// `maxPositionals` counts the arguments after `pr`; options are listed as typed,
// so `pr create` lists the branch aliases. Any other subcommand or action
// matches no rule and stays lenient.
const GLOBAL_OPTIONS = ['--json', '--workspace', '--repo'];
const BODY_PROSE = { inline: '--body', file: '--body-file' };
const DESCRIPTION_PROSE = { inline: '--description', file: '--description-file' };

function prRule(
    words: string,
    options: string[],
    maxPositionals: number,
    prose?: StrictRule['prose'],
): [string, StrictRule] {
    const command = `pr ${words}`;
    const rule: StrictRule = {
        command: `af bitbucket ${command}`,
        options: [...options, ...GLOBAL_OPTIONS],
        maxPositionals,
    };
    if (prose) rule.prose = prose;
    return [command, rule];
}

const STRICT_RULES = new Map<string, StrictRule>([
    prRule(
        'create',
        [
            '--title',
            '--description',
            '--description-file',
            '--from',
            '--source',
            '--src',
            '--to',
            '--destination',
            '--dest',
            '--reviewers',
            '--draft',
        ],
        1,
        DESCRIPTION_PROSE,
    ),
    prRule(
        'update',
        ['--title', '--description', '--description-file', '--reviewers'],
        2,
        DESCRIPTION_PROSE,
    ),
    prRule('comment list', ['--resolved', '--unresolved'], 3),
    prRule(
        'comment add',
        ['--body', '--body-file', '--file', '--line', '--reply-to'],
        3,
        BODY_PROSE,
    ),
    prRule('comment update', ['--body', '--body-file'], 4, BODY_PROSE),
    prRule('comment get', [], 4),
    prRule('comment delete', [], 4),
    prRule('comment resolve', [], 4),
    prRule('comment reopen', [], 4),
    prRule('task list', ['--resolved', '--unresolved'], 3),
    prRule('task add', ['--body', '--body-file', '--on-comment'], 3, BODY_PROSE),
    prRule('task update', ['--body', '--body-file', '--resolved', '--unresolved'], 4, BODY_PROSE),
    prRule('task delete', [], 4),
]);

/** The strict rule for `<subcommand> <args…>`, or undefined when the command is lenient. */
function findStrictRule(subcommand: string, args: string[]): StrictRule | undefined {
    if (subcommand !== 'pr') return undefined;
    const nested = args[0] === 'comment' || args[0] === 'task';
    return STRICT_RULES.get(['pr', ...args.slice(0, nested ? 2 : 1)].join(' '));
}

/**
 * Parses argv into the subcommand, its positional arguments and the options.
 * `--name=value` is split at the first `=` (the value may be empty or contain
 * `=`) before the alias lookup; a boolean flag written with `=` is an error.
 * The pull request prose commands are then checked against `STRICT_RULES`.
 */
export function parseArgs(argv: string[]): {
    subcommand: string;
    args: string[];
    options: BitbucketOptions;
} {
    const args: string[] = [];
    const options: BitbucketOptions = {};
    // Option names as typed (before alias normalization, without `=value`),
    // for the strict check.
    const typedOptions: string[] = [];
    // The last argument when it is an option that needs a value. Reported
    // after the strict check: on a strict command a trailing `--resolve` is an
    // unknown option (with a suggestion), not an option missing its value.
    let missingValue: string | undefined;

    let i = 0;
    while (i < argv.length) {
        const token = splitOptionToken(argv[i]);
        if (token) {
            const typed = token.flag;
            typedOptions.push(typed);
            const flag = FLAG_ALIASES.get(typed) ?? typed;
            const key = flag.slice(2);
            if (BOOLEAN_FLAGS.has(flag)) {
                if (token.inlineValue !== undefined) {
                    throw new Error(`Option ${typed} does not take a value`);
                }
                (options as Record<string, boolean>)[key] = true;
            } else {
                const value = token.inlineValue ?? argv[++i];
                if (value === undefined) {
                    // Only the last argument can lack a value, so the loop ends here.
                    missingValue = typed;
                    break;
                }
                if (REPEATABLE_FLAGS.has(flag)) {
                    const rec = options as Record<string, string[] | undefined>;
                    (rec[key] ??= []).push(value);
                } else if (NUMBER_FLAGS.has(flag)) {
                    (options as Record<string, number>)[key] = parseInt(value, 10);
                } else {
                    (options as Record<string, string>)[key] = value;
                }
            }
        } else {
            args.push(argv[i]);
        }
        i++;
    }

    const subcommand = args[0] ?? '';
    const subArgs = args.slice(1);
    const rule = findStrictRule(subcommand, subArgs);
    if (rule) checkStrictArgs(rule, typedOptions, subArgs);
    if (missingValue !== undefined) throw new Error(`Option ${missingValue} requires a value`);
    return { subcommand, args: subArgs, options };
}

/** Prints the full `af bitbucket` reference (also shown for `af bb` and `af help bb`). */
export function showBitbucketHelp(): void {
    console.log(`
Bitbucket CLI - Manage Bitbucket Cloud pull requests, comments, tasks, pipelines,
and inspect repos, refs, commits, and source (read-only)

USAGE:
  af bitbucket <subcommand> [args] [options]
  af bb <subcommand> [args] [options]              (alias)

PULL REQUESTS:
  pr list [--state OPEN|MERGED|DECLINED|SUPERSEDED|ALL] [--mine | --author Q] [--checks]
  pr mine [--state OPEN|MERGED|DECLINED|SUPERSEDED|ALL] [--limit N] [--checks]
                                                    My authored PRs across all my workspaces
                                                    (--workspace W narrows; use --limit with ALL)
  pr get <id>
  pr diff <id>
  pr create --title T [--from B] [--to B]
            [--description TEXT / --description-file <path|->]
            [--reviewers a,b] [--draft]
            (--from also accepts --source, --src; --to also accepts --destination, --dest)
  pr update <id> [--title T] [--description TEXT / --description-file <path|->]
                 [--reviewers a,b]
  pr approve <id>           pr unapprove <id>
  pr request-changes <id>
  pr merge <id> [--strategy merge_commit|squash|fast_forward] [--close-source]
  pr decline <id>
  pr activity <id> [--limit N]                     Chronological activity feed
  pr status <id>                                    Build/commit statuses (gate view)
  pr reviewers <id> [--pending]                     Reviewers + approval state

  The pr list and pr mine tables show Review (✓ approvals, ✗ changes requested,
  ○ pending reviewers) and open Tasks, at no extra request cost.
  --checks adds Builds (head commit) and Conflicts for open PRs, at about three
  requests per listed open PR (more when a PR has many build statuses). It is
  informational only and never changes the exit code. It has no effect with --json.

PR COMMENTS:
  pr comment list <pr-id> [--resolved | --unresolved]
  pr comment get <pr-id> <comment-id>
  pr comment add <pr-id> --body TEXT / --body-file <path|->
                         [--file PATH --line N]
                         [--reply-to COMMENT-ID]
  pr comment update <pr-id> <comment-id> --body TEXT / --body-file <path|->
  pr comment delete <pr-id> <comment-id>
  pr comment resolve <pr-id> <comment-id>          Resolve a comment thread
  pr comment reopen <pr-id> <comment-id>           Reopen a resolved thread

PR TASKS:
  pr task list <pr-id> [--resolved | --unresolved]
  pr task add <pr-id> --body TEXT / --body-file <path|-> [--on-comment COMMENT-ID]
  pr task update <pr-id> <task-id> [--body TEXT / --body-file <path|->]
                 [--resolved | --unresolved]
  pr task delete <pr-id> <task-id>

  Comment and task bodies and PR descriptions are sent as typed; Bitbucket renders
  them as markdown. --body-file and --description-file take a file path, or - to
  read the text from standard input (see MULTI-LINE TEXT).

PIPELINES:
  pipeline list [--branch B] [--status PENDING|IN_PROGRESS|SUCCESSFUL|FAILED|...]
  pipeline get <uuid|build-number>
  pipeline trigger [--branch B] [--commit SHA] [--custom NAME] [--var k=v]
  pipeline stop <uuid>
  pipeline steps <uuid>
  pipeline logs <pipeline-uuid> <step-uuid> [--follow]

REPOSITORY & REFS (read-only):
  whoami                                            Show the authenticated account
  repo list [--query Q] [--role R] [--sort S]       List workspace repositories
  repo get                                          Show the resolved repository
  branch list [--query Q] [--sort S]   branch get <name>
  tag list [--query Q] [--sort S]      tag get <name>

COMMITS & SOURCE (read-only):
  commit list [--branch B] [--include REF] [--exclude REF] [--limit N]
  commit get <sha> [--diff | --diffstat | --patch]
  src read <path> [--ref REF]                       Raw file content at a ref
  src ls [path] [--ref REF] [--recursive]           Browse a directory at a ref
  diff <spec> [--stat]                              Diff a revspec, e.g. main..feature

MEMBERS:
  members [--query Q]                                Look up account IDs

OPTIONS:
  --workspace W   Override resolved workspace
  --repo R        Override resolved repository
  --json          Emit raw JSON instead of human-formatted output

  Options that take a value also accept --name=value. pr create, pr update,
  pr comment and pr task reject options they do not know and extra arguments.

MULTI-LINE TEXT:
  Inside "double" or 'single' quotes, \\n stays a backslash and an n; it is never
  a newline. Double quotes also run \`commands\` and expand $VARS. For multi-line
  text, use a -file flag: pass a path, or - and a quoted heredoc (keep AF_BODY
  at the start of its line):

af bb pr comment add 42 --body-file - <<'AF_BODY'
## Summary

- First point
AF_BODY

EXAMPLES:
  af bb pr list --state OPEN
  af bb pr mine
  af bb pr mine --state ALL --limit 20
  af bb pr mine --checks
  af bb pr create --title "Fix bug" --reviewers a:abc123,b:def456
  af bb pr comment add 42 --body "Looks good" --reply-to 100
  af bb pr task add 42 --body "Rename this" --on-comment 100
  af bb pr task update 42 7 --resolved
  af bb pipeline trigger --branch main --custom nightly --var FOO=bar
  af bb pipeline logs {uuid} {step-uuid} --follow
  af bb whoami
  af bb repo list --sort -updated_on
  af bb commit list --branch main --limit 5
  af bb src read README.md --ref main
  af bb diff main..feature/x --stat
  af bb pr status 42
`);
}

// Comment and task bodies and PR descriptions are prose: inline, from a file,
// or from stdin with `-`, resolved by `readProse` only after every argument
// check and before any request. The text is sent as typed (Bitbucket renders
// markdown). A body is required to be non-empty; a description may be `""`.

function bodySource(opts: BitbucketOptions): ProseSource {
    return {
        flag: '--body',
        value: opts.body,
        fileFlag: '--body-file',
        file: opts['body-file'],
    };
}

function descriptionSource(opts: BitbucketOptions): ProseSource {
    return {
        flag: '--description',
        value: opts.description,
        fileFlag: '--description-file',
        file: opts['description-file'],
    };
}

function parseReviewers(flag: string | undefined): string[] | undefined {
    if (!flag) return undefined;
    return flag
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
}

function parseVars(flags: string[] | undefined): { key: string; value: string }[] | undefined {
    if (!flags?.length) return undefined;
    return flags.map(kv => {
        const idx = kv.indexOf('=');
        if (idx < 0) throw new Error(`--var requires KEY=VALUE format, got: ${kv}`);
        return { key: kv.slice(0, idx), value: kv.slice(idx + 1) };
    });
}

function requireArg(value: string | undefined, name: string): string {
    if (value === undefined || value === '') {
        throw new Error(`${name} required`);
    }
    return value;
}

function requireIdArg(value: string | undefined, name: string): number {
    const v = requireArg(value, name);
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) throw new Error(`${name} must be a number`);
    return n;
}

/** Reject a `--limit` that parsed to NaN/≤0, which would otherwise silently
 *  disable the page cap and drain the full history. */
function checkLimit(options: BitbucketOptions): void {
    if (options.limit !== undefined && (!Number.isFinite(options.limit) || options.limit <= 0)) {
        throw new Error('--limit must be a positive integer');
    }
}

const PR_STATES = new Set(['OPEN', 'MERGED', 'DECLINED', 'SUPERSEDED', 'ALL']);

/** Normalize `--state` for `pr list` / `pr mine` (default OPEN); throws on an unknown state. */
function parsePrState(options: BitbucketOptions): BitbucketPullRequestState | 'ALL' {
    const state = (options.state ?? 'OPEN').toUpperCase();
    if (!PR_STATES.has(state)) throw new Error(`invalid --state ${state}`);
    return state as BitbucketPullRequestState | 'ALL';
}

const TERMINAL_STEP_STATES = new Set(['SUCCESSFUL', 'FAILED', 'STOPPED', 'ERROR']);

export async function handleBitbucket(args: string[]): Promise<number> {
    if (args.includes('--help') || args.includes('-h')) {
        showBitbucketHelp();
        return 0;
    }

    let parsed: ReturnType<typeof parseArgs>;
    try {
        parsed = parseArgs(args);
    } catch (err) {
        error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        return 1;
    }

    const { subcommand, args: subArgs, options } = parsed;
    const json = options.json ?? false;

    if (!subcommand || subcommand === 'help') {
        showBitbucketHelp();
        return 0;
    }

    const client = await import('../bitbucket/lib/client.ts');
    const fmt = await import('../bitbucket/lib/formatters.ts');
    const { resolveTarget } = await import('../bitbucket/lib/config.ts');

    const target = (() => {
        try {
            return resolveTarget({ workspace: options.workspace, repo: options.repo });
        } catch (err) {
            return err instanceof Error ? err : new Error(String(err));
        }
    })();
    const ws = target instanceof Error ? '' : target.workspace;
    const repo = target instanceof Error ? '' : target.repo;

    function ensureTarget(): boolean {
        if (target instanceof Error) {
            error(`Error: ${target.message}`);
            return false;
        }
        return true;
    }

    try {
        switch (subcommand) {
            case 'pr':
                return await handlePr(subArgs, options, json, ensureTarget, ws, repo, client, fmt);
            case 'pipeline':
                return await handlePipeline(
                    subArgs,
                    options,
                    json,
                    ensureTarget,
                    ws,
                    repo,
                    client,
                    fmt,
                );
            case 'whoami': {
                const account = await client.getCurrentUser();
                fmt.output(json ? account : fmt.formatAccount(account), false);
                return 0;
            }
            case 'repo':
                return await handleRepo(subArgs, options, json, client, fmt);
            case 'branch':
                return await handleBranch(
                    subArgs,
                    options,
                    json,
                    ensureTarget,
                    ws,
                    repo,
                    client,
                    fmt,
                );
            case 'tag':
                return await handleTag(subArgs, options, json, ensureTarget, ws, repo, client, fmt);
            case 'commit':
                return await handleCommit(
                    subArgs,
                    options,
                    json,
                    ensureTarget,
                    ws,
                    repo,
                    client,
                    fmt,
                );
            case 'src':
                return await handleSrc(subArgs, options, json, ensureTarget, ws, repo, client, fmt);
            case 'diff':
                return await handleDiff(
                    subArgs,
                    options,
                    json,
                    ensureTarget,
                    ws,
                    repo,
                    client,
                    fmt,
                );
            case 'members': {
                if (target instanceof Error) {
                    error(`Error: ${target.message}`);
                    return 1;
                }
                const members = await client.listMembers(ws, { query: options.query });
                fmt.output(json ? members : fmt.formatMembers(members), false);
                return 0;
            }
            default:
                error(`Error: Unknown subcommand: ${subcommand}`);
                console.error("Run 'af bitbucket --help' for available subcommands.");
                return 1;
        }
    } catch (err) {
        error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        return 1;
    }
}

type ClientModule = typeof import('../bitbucket/lib/client.ts');
type FmtModule = typeof import('../bitbucket/lib/formatters.ts');

async function handlePr(
    args: string[],
    options: BitbucketOptions,
    json: boolean,
    ensureTarget: () => boolean,
    ws: string,
    repo: string,
    client: ClientModule,
    fmt: FmtModule,
): Promise<number> {
    const action = args[0];
    if (!action) {
        error('Error: pr requires a subcommand (list, get, create, update, ...)');
        return 1;
    }

    if (action === 'comment')
        return await handleComment(
            args.slice(1),
            options,
            json,
            ensureTarget,
            ws,
            repo,
            client,
            fmt,
        );
    if (action === 'task')
        return await handleTask(args.slice(1), options, json, ensureTarget, ws, repo, client, fmt);
    // Workspace-wide: needs no repository, so it routes before target resolution.
    if (action === 'mine') return await handlePrMine(options, json, client, fmt);

    if (!ensureTarget()) return 1;

    switch (action) {
        case 'list': {
            const state = parsePrState(options);
            const q = options.author ? `author.nickname="${options.author}"` : undefined;
            const prs = await client.listPullRequests(ws, repo, { state, q });
            let filtered = prs;
            if (options.mine) {
                const { bbRequest } = await import('../bitbucket/lib/request.ts');
                const user = await bbRequest<{ account_id: string }>(
                    'https://api.bitbucket.org/2.0/user',
                );
                filtered = prs.filter(p => p.author.account_id === user.account_id);
            }
            await outputPullRequests(
                filtered,
                options,
                json,
                client,
                fmt,
                fmt.formatPullRequestList,
            );
            return 0;
        }
        case 'get': {
            const id = requireIdArg(args[1], 'pr id');
            const pr = await client.getPullRequest(ws, repo, id);
            fmt.output(json ? pr : fmt.formatPullRequest(pr), false);
            return 0;
        }
        case 'diff': {
            const id = requireIdArg(args[1], 'pr id');
            const diff = await client.getPullRequestDiff(ws, repo, id);
            console.log(diff);
            return 0;
        }
        case 'create': {
            const title = requireArg(options.title, '--title');
            const descriptionInput = descriptionSource(options);
            assertSingleSource(descriptionInput);
            let source = options.from;
            if (!source) source = client.getCurrentBranch() ?? undefined;
            if (!source) {
                error('Error: --from required (could not detect current branch)');
                return 1;
            }
            // Read the description after the argument checks, before the main
            // branch lookup below, so a bad input sends no request at all.
            const description = readProse(descriptionInput);
            let destination = options.to;
            if (!destination) {
                const repoInfo = await client.getRepository(ws, repo);
                destination = repoInfo.mainbranch?.name;
            }
            const pr = await client.createPullRequest(ws, repo, {
                title,
                source,
                destination,
                description,
                reviewerAccountIds: parseReviewers(options.reviewers),
                draft: options.draft,
            });
            fmt.output(json ? pr : fmt.formatPullRequest(pr), false);
            return 0;
        }
        case 'update': {
            const id = requireIdArg(args[1], 'pr id');
            // `--description ""` is sent as is, which clears the description.
            const description = readProse(descriptionSource(options));
            const pr = await client.updatePullRequest(ws, repo, id, {
                title: options.title,
                description,
                reviewerAccountIds: parseReviewers(options.reviewers),
            });
            fmt.output(json ? pr : fmt.formatPullRequest(pr), false);
            return 0;
        }
        case 'approve': {
            const id = requireIdArg(args[1], 'pr id');
            const result = await client.approvePullRequest(ws, repo, id);
            if (json) fmt.output(result, true);
            else console.log(`Approved PR #${id}`);
            return 0;
        }
        case 'unapprove': {
            const id = requireIdArg(args[1], 'pr id');
            await client.unapprovePullRequest(ws, repo, id);
            if (!json) console.log(`Unapproved PR #${id}`);
            return 0;
        }
        case 'request-changes': {
            const id = requireIdArg(args[1], 'pr id');
            const result = await client.requestChangesPullRequest(ws, repo, id);
            if (json) fmt.output(result, true);
            else console.log(`Requested changes on PR #${id}`);
            return 0;
        }
        case 'merge': {
            const id = requireIdArg(args[1], 'pr id');
            const validStrats = new Set(['merge_commit', 'squash', 'fast_forward']);
            const strategy = options.strategy;
            if (strategy && !validStrats.has(strategy)) {
                error(`Error: invalid --strategy ${strategy}`);
                return 1;
            }
            const pr = await client.mergePullRequest(ws, repo, id, {
                strategy: strategy as 'merge_commit' | 'squash' | 'fast_forward' | undefined,
                closeSource: options['close-source'],
            });
            fmt.output(json ? pr : fmt.formatPullRequest(pr), false);
            return 0;
        }
        case 'decline': {
            const id = requireIdArg(args[1], 'pr id');
            const pr = await client.declinePullRequest(ws, repo, id);
            fmt.output(json ? pr : fmt.formatPullRequest(pr), false);
            return 0;
        }
        case 'activity': {
            const id = requireIdArg(args[1], 'pr id');
            checkLimit(options);
            const activity = await client.listPullRequestActivity(ws, repo, id, {
                limit: options.limit,
            });
            fmt.output(json ? activity : fmt.formatActivity(activity), false);
            return 0;
        }
        case 'status': {
            // Informational: always exits 0 even when a status is FAILED.
            const id = requireIdArg(args[1], 'pr id');
            const statuses = await client.listPullRequestStatuses(ws, repo, id);
            fmt.output(json ? statuses : fmt.formatStatusList(statuses), false);
            return 0;
        }
        case 'reviewers': {
            const id = requireIdArg(args[1], 'pr id');
            const pr = await client.getPullRequest(ws, repo, id);
            const participants = pr.participants ?? [];
            fmt.output(
                json ? participants : fmt.formatReviewers(participants, options.pending),
                false,
            );
            return 0;
        }
        default:
            error(`Error: Unknown pr subcommand: ${action}`);
            return 1;
    }
}

/**
 * `pr mine`: the caller's authored PRs across every workspace they belong to.
 * Only an explicit `--workspace` narrows the search — `af.json` and the git
 * remote are repo-context signals and are deliberately ignored here.
 */
async function handlePrMine(
    options: BitbucketOptions,
    json: boolean,
    client: ClientModule,
    fmt: FmtModule,
): Promise<number> {
    const state = parsePrState(options);
    checkLimit(options);
    const { pullRequests, skipped } = await client.listMyPullRequests({
        workspace: options.workspace,
        state,
        limit: options.limit,
    });
    // stderr, not `warn()` (which writes stdout), so `--json` output stays parseable.
    for (const s of skipped) {
        console.error(
            `Warning: skipped workspace "${s.workspace}" (HTTP ${s.status}): ${s.message}`,
        );
    }
    await outputPullRequests(pullRequests, options, json, client, fmt, fmt.formatMyPullRequestList);
    return 0;
}

const CHECKS_JSON_NOTICE =
    "Note: --checks has no effect with --json (for build statuses use 'af bb pr status <id> --json')";

/**
 * Print the pull requests of `pr list` / `pr mine`. With `--checks`, the merge
 * signals of exactly these (displayed) pull requests are fetched and rendered,
 * and signals that could not be fetched are reported afterwards as grouped
 * warnings. Signals are informational: nothing here affects the exit code.
 * `--json` stays the raw array, so there `--checks` only earns a notice.
 */
async function outputPullRequests(
    prs: BitbucketPullRequest[],
    options: BitbucketOptions,
    json: boolean,
    client: ClientModule,
    fmt: FmtModule,
    format: (prs: BitbucketPullRequest[], signals?: (PullRequestSignals | null)[]) => string,
): Promise<void> {
    // stderr, not `warn()` (which writes stdout), so `--json` output stays parseable.
    if (json) {
        if (options.checks) console.error(CHECKS_JSON_NOTICE);
        fmt.output(prs, false);
        return;
    }
    if (!options.checks) {
        fmt.output(format(prs), false);
        return;
    }
    const signals = await client.listPullRequestSignals(prs);
    fmt.output(format(prs, signals), false);
    for (const line of groupSignalFailures(signals)) console.error(line);
}

async function handleComment(
    args: string[],
    options: BitbucketOptions,
    json: boolean,
    ensureTarget: () => boolean,
    ws: string,
    repo: string,
    client: ClientModule,
    fmt: FmtModule,
): Promise<number> {
    if (!ensureTarget()) return 1;

    const action = args[0];
    switch (action) {
        case 'list': {
            const prId = requireIdArg(args[1], 'pr id');
            if (options.resolved && options.unresolved) {
                error('Error: --resolved and --unresolved are mutually exclusive');
                return 1;
            }
            const filter = resolutionFilterFromFlags(options.resolved, options.unresolved);
            const comments = filterCommentsByResolution(
                await client.listComments(ws, repo, prId),
                filter,
            );
            fmt.output(json ? comments : fmt.formatCommentList(comments), false);
            return 0;
        }
        case 'get': {
            const prId = requireIdArg(args[1], 'pr id');
            const cid = requireIdArg(args[2], 'comment id');
            const c = await client.getComment(ws, repo, prId, cid);
            fmt.output(json ? c : fmt.formatCommentList([c]), false);
            return 0;
        }
        case 'add': {
            const prId = requireIdArg(args[1], 'pr id');
            const bodyInput = bodySource(options);
            assertSingleSource(bodyInput);
            const inlineFile = options.file;
            const inlineLine = options.line;
            if (
                (inlineFile && inlineLine === undefined) ||
                (!inlineFile && inlineLine !== undefined)
            ) {
                error('Error: --file and --line must be supplied together');
                return 1;
            }
            // Read the body only after the argument checks above. Without a
            // body flag nothing is read and `readProse` returns undefined.
            const body = readProse(bodyInput, { required: true });
            if (body === undefined) {
                error('Error: --body or --body-file required');
                return 1;
            }
            const c = await client.addComment(ws, repo, prId, {
                body,
                inline: inlineFile ? { path: inlineFile, to: inlineLine } : undefined,
                parentId: options['reply-to'],
            });
            fmt.output(json ? c : fmt.formatCommentList([c]), false);
            return 0;
        }
        case 'update': {
            const prId = requireIdArg(args[1], 'pr id');
            const cid = requireIdArg(args[2], 'comment id');
            const body = readProse(bodySource(options), { required: true });
            if (body === undefined) {
                error('Error: --body or --body-file required');
                return 1;
            }
            const c = await client.updateComment(ws, repo, prId, cid, body);
            fmt.output(json ? c : fmt.formatCommentList([c]), false);
            return 0;
        }
        case 'delete': {
            const prId = requireIdArg(args[1], 'pr id');
            const cid = requireIdArg(args[2], 'comment id');
            await client.deleteComment(ws, repo, prId, cid);
            if (!json) console.log(`Deleted comment #${cid}`);
            return 0;
        }
        case 'resolve': {
            const prId = requireIdArg(args[1], 'pr id');
            const cid = requireIdArg(args[2], 'comment id');
            const result = await client.resolveComment(ws, repo, prId, cid);
            if (json) fmt.output(result, true);
            else console.log(`Resolved comment #${cid}`);
            return 0;
        }
        case 'reopen': {
            const prId = requireIdArg(args[1], 'pr id');
            const cid = requireIdArg(args[2], 'comment id');
            const result = await client.reopenComment(ws, repo, prId, cid);
            if (json) fmt.output(result, true);
            else console.log(`Reopened comment #${cid}`);
            return 0;
        }
        default:
            error(`Error: Unknown comment subcommand: ${action}`);
            return 1;
    }
}

async function handleTask(
    args: string[],
    options: BitbucketOptions,
    json: boolean,
    ensureTarget: () => boolean,
    ws: string,
    repo: string,
    client: ClientModule,
    fmt: FmtModule,
): Promise<number> {
    if (!ensureTarget()) return 1;

    const action = args[0];
    switch (action) {
        case 'list': {
            const prId = requireIdArg(args[1], 'pr id');
            if (options.resolved && options.unresolved) {
                error('Error: --resolved and --unresolved are mutually exclusive');
                return 1;
            }
            const filter = resolutionFilterFromFlags(options.resolved, options.unresolved);
            const tasks = filterTasksByResolution(await client.listTasks(ws, repo, prId), filter);
            fmt.output(json ? tasks : fmt.formatTaskList(tasks), false);
            return 0;
        }
        case 'add': {
            const prId = requireIdArg(args[1], 'pr id');
            const body = readProse(bodySource(options), { required: true });
            if (body === undefined) {
                error('Error: --body or --body-file required');
                return 1;
            }
            const t = await client.addTask(ws, repo, prId, {
                body,
                onCommentId: options['on-comment'],
            });
            fmt.output(json ? t : fmt.formatTaskList([t]), false);
            return 0;
        }
        case 'update': {
            const prId = requireIdArg(args[1], 'pr id');
            const tid = requireIdArg(args[2], 'task id');
            if (options.resolved && options.unresolved) {
                error('Error: --resolved and --unresolved are mutually exclusive');
                return 1;
            }
            // No body flag means "leave the body alone": `readProse` then
            // returns undefined, while an empty inline `--body ""` is an error.
            const body = readProse(bodySource(options), { required: true });
            const state = options.resolved
                ? 'RESOLVED'
                : options.unresolved
                  ? 'UNRESOLVED'
                  : undefined;
            if (body === undefined && state === undefined) {
                error('Error: provide --body / --body-file or --resolved / --unresolved');
                return 1;
            }
            const t = await client.updateTask(ws, repo, prId, tid, { body, state });
            fmt.output(json ? t : fmt.formatTaskList([t]), false);
            return 0;
        }
        case 'delete': {
            const prId = requireIdArg(args[1], 'pr id');
            const tid = requireIdArg(args[2], 'task id');
            await client.deleteTask(ws, repo, prId, tid);
            if (!json) console.log(`Deleted task #${tid}`);
            return 0;
        }
        default:
            error(`Error: Unknown task subcommand: ${action}`);
            return 1;
    }
}

async function handlePipeline(
    args: string[],
    options: BitbucketOptions,
    json: boolean,
    ensureTarget: () => boolean,
    ws: string,
    repo: string,
    client: ClientModule,
    fmt: FmtModule,
): Promise<number> {
    if (!ensureTarget()) return 1;

    const action = args[0];
    switch (action) {
        case 'list': {
            const status = options.status as
                | 'PENDING'
                | 'IN_PROGRESS'
                | 'SUCCESSFUL'
                | 'FAILED'
                | 'STOPPED'
                | 'ERROR'
                | 'PAUSED'
                | 'HALTED'
                | 'EXPIRED'
                | undefined;
            const pipelines = await client.listPipelines(ws, repo, {
                branch: options.branch,
                status,
            });
            fmt.output(json ? pipelines : fmt.formatPipelineList(pipelines), false);
            return 0;
        }
        case 'get': {
            const id = requireArg(args[1], 'pipeline uuid or build number');
            const p = await client.getPipeline(ws, repo, id);
            fmt.output(json ? p : fmt.formatPipeline(p), false);
            return 0;
        }
        case 'trigger': {
            if (!options.branch && !options.commit) {
                error('Error: --branch or --commit required');
                return 1;
            }
            const variables = parseVars(options.var);
            const p = await client.triggerPipeline(ws, repo, {
                branch: options.branch,
                commit: options.commit,
                custom: options.custom,
                variables,
            });
            fmt.output(json ? p : fmt.formatPipeline(p), false);
            return 0;
        }
        case 'stop': {
            const uuid = requireArg(args[1], 'pipeline uuid');
            await client.stopPipeline(ws, repo, uuid);
            if (!json) console.log(`Stopped pipeline ${uuid}`);
            return 0;
        }
        case 'steps': {
            const uuid = requireArg(args[1], 'pipeline uuid');
            const steps = await client.listSteps(ws, repo, uuid);
            fmt.output(json ? steps : fmt.formatStepList(steps), false);
            return 0;
        }
        case 'logs': {
            const pipelineUuid = requireArg(args[1], 'pipeline uuid');
            const stepUuid = requireArg(args[2], 'step uuid');
            if (options.follow) {
                let written = 0;
                while (true) {
                    const text = await client.getStepLog(ws, repo, pipelineUuid, stepUuid);
                    if (text.length > written) {
                        process.stdout.write(text.slice(written));
                        written = text.length;
                    }
                    const step = await client.getStep(ws, repo, pipelineUuid, stepUuid);
                    const result = step.state.result?.name;
                    const stateName = step.state.name;
                    if (
                        TERMINAL_STEP_STATES.has(stateName) ||
                        (result && TERMINAL_STEP_STATES.has(result))
                    ) {
                        // One last fetch in case anything trailed in.
                        const final = await client.getStepLog(ws, repo, pipelineUuid, stepUuid);
                        if (final.length > written) {
                            process.stdout.write(final.slice(written));
                        }
                        break;
                    }
                    await new Promise(r => setTimeout(r, 2000));
                }
                return 0;
            }
            const text = await client.getStepLog(ws, repo, pipelineUuid, stepUuid);
            console.log(text);
            return 0;
        }
        default:
            error(`Error: Unknown pipeline subcommand: ${action}`);
            return 1;
    }
}

async function handleRepo(
    args: string[],
    options: BitbucketOptions,
    json: boolean,
    client: ClientModule,
    fmt: FmtModule,
): Promise<number> {
    const { resolveWorkspace, resolveTarget } = await import('../bitbucket/lib/config.ts');
    const action = args[0] ?? 'get';
    switch (action) {
        case 'list': {
            // `repo list` needs only a workspace, not a specific repository.
            const ws = resolveWorkspace({ workspace: options.workspace });
            const repos = await client.listRepositories(ws, {
                query: options.query,
                role: options.role,
                sort: options.sort,
            });
            fmt.output(json ? repos : fmt.formatRepositoryList(repos), false);
            return 0;
        }
        case 'get': {
            const target = resolveTarget({ workspace: options.workspace, repo: options.repo });
            const repo = await client.getRepository(target.workspace, target.repo);
            fmt.output(json ? repo : fmt.formatRepository(repo), false);
            return 0;
        }
        default:
            error(`Error: Unknown repo subcommand: ${action} (expected list or get)`);
            return 1;
    }
}

async function handleBranch(
    args: string[],
    options: BitbucketOptions,
    json: boolean,
    ensureTarget: () => boolean,
    ws: string,
    repo: string,
    client: ClientModule,
    fmt: FmtModule,
): Promise<number> {
    if (!ensureTarget()) return 1;
    const action = args[0] ?? 'list';
    switch (action) {
        case 'list': {
            const branches = await client.listBranches(ws, repo, {
                query: options.query,
                sort: options.sort,
            });
            fmt.output(json ? branches : fmt.formatBranchList(branches), false);
            return 0;
        }
        case 'get': {
            const name = requireArg(args[1], 'branch name');
            const branch = await client.getBranch(ws, repo, name);
            fmt.output(json ? branch : fmt.formatBranch(branch), false);
            return 0;
        }
        default:
            error(`Error: Unknown branch subcommand: ${action} (expected list or get)`);
            return 1;
    }
}

async function handleTag(
    args: string[],
    options: BitbucketOptions,
    json: boolean,
    ensureTarget: () => boolean,
    ws: string,
    repo: string,
    client: ClientModule,
    fmt: FmtModule,
): Promise<number> {
    if (!ensureTarget()) return 1;
    const action = args[0] ?? 'list';
    switch (action) {
        case 'list': {
            const tags = await client.listTags(ws, repo, {
                query: options.query,
                sort: options.sort,
            });
            fmt.output(json ? tags : fmt.formatTagList(tags), false);
            return 0;
        }
        case 'get': {
            const name = requireArg(args[1], 'tag name');
            const tag = await client.getTag(ws, repo, name);
            fmt.output(json ? tag : fmt.formatTag(tag), false);
            return 0;
        }
        default:
            error(`Error: Unknown tag subcommand: ${action} (expected list or get)`);
            return 1;
    }
}

async function handleCommit(
    args: string[],
    options: BitbucketOptions,
    json: boolean,
    ensureTarget: () => boolean,
    ws: string,
    repo: string,
    client: ClientModule,
    fmt: FmtModule,
): Promise<number> {
    if (!ensureTarget()) return 1;
    const action = args[0] ?? 'list';
    switch (action) {
        case 'list': {
            checkLimit(options);
            const commits = await client.listCommits(ws, repo, {
                branch: options.branch,
                include: options.include,
                exclude: options.exclude,
                limit: options.limit,
            });
            fmt.output(json ? commits : fmt.formatCommitList(commits), false);
            return 0;
        }
        case 'get': {
            const sha = requireArg(args[1], 'commit sha');
            if (options.diff) {
                console.log(await client.getDiff(ws, repo, sha));
                return 0;
            }
            if (options.patch) {
                console.log(await client.getPatch(ws, repo, sha));
                return 0;
            }
            if (options.diffstat) {
                const stat = await client.getDiffStat(ws, repo, sha);
                fmt.output(json ? stat : fmt.formatDiffStat(stat), false);
                return 0;
            }
            const commit = await client.getCommit(ws, repo, sha);
            fmt.output(json ? commit : fmt.formatCommit(commit), false);
            return 0;
        }
        default:
            error(`Error: Unknown commit subcommand: ${action} (expected list or get)`);
            return 1;
    }
}

async function handleSrc(
    args: string[],
    options: BitbucketOptions,
    json: boolean,
    ensureTarget: () => boolean,
    ws: string,
    repo: string,
    client: ClientModule,
    fmt: FmtModule,
): Promise<number> {
    if (!ensureTarget()) return 1;
    const action = args[0];
    switch (action) {
        case 'read': {
            const path = requireArg(args[1], 'file path');
            const content = await client.readSource(ws, repo, path, options.ref);
            process.stdout.write(content);
            return 0;
        }
        case 'ls': {
            const path = args[1] ?? '';
            const entries = await client.browseSource(ws, repo, path, {
                ref: options.ref,
                recursive: options.recursive,
            });
            fmt.output(json ? entries : fmt.formatSrcList(entries), false);
            return 0;
        }
        default:
            error(
                action
                    ? `Error: Unknown src subcommand: ${action} (expected read or ls)`
                    : 'Error: src requires a subcommand (read, ls)',
            );
            return 1;
    }
}

async function handleDiff(
    args: string[],
    options: BitbucketOptions,
    json: boolean,
    ensureTarget: () => boolean,
    ws: string,
    repo: string,
    client: ClientModule,
    fmt: FmtModule,
): Promise<number> {
    if (!ensureTarget()) return 1;
    const spec = requireArg(args[0], 'revspec (e.g. main..feature)');
    if (options.stat) {
        const stat = await client.getDiffStat(ws, repo, spec);
        fmt.output(json ? stat : fmt.formatDiffStat(stat), false);
        return 0;
    }
    console.log(await client.getDiff(ws, repo, spec));
    return 0;
}
