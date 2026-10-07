## 1. Prerequisite and baseline

- [x] 1.1 Confirm that `fix-adf-converter-hang` is implemented before writing any code here. If any of these checks fails, stop and implement that change first: this change feeds CRLF and BOM-prefixed text into `textToAdf`.
    - The change is archived (`openspec/changes/archive/*-fix-adf-converter-hang/` exists), or every task in `openspec/changes/fix-adf-converter-hang/tasks.md` is checked.
    - `bun run test atlassian/lib/adf.test.ts` passes, including the child-process hang tests.
    - `timeout 10 bun --no-env-file -e "const { textToAdf } = await import('./atlassian/lib/adf.ts'); console.log(JSON.stringify(textToAdf('\uFEFF## Summary\r\n\r\n- one\r\n## \r\n')))"` returns. It prints a heading `Summary`, a bullet list and an empty heading, with no `\r` and no empty text node.
- [x] 1.2 Record the type-check baseline with `npx tsc --noEmit --pretty false 2>&1 | grep -c 'error TS'`. Keep `--pretty false`: the installed TypeScript 7 colors its output even when piped, and without the flag the count is 0. At planning time HEAD had 29 errors, in these files:
    - `bun-upgrade.test.ts`;
    - `commands/bitbucket.test.ts` (6);
    - `npm-upgrade.test.ts`;
    - `resources/copy-prompt-reporter.ts`;
    - `sonar/lib/client.test.ts`;
    - `sonar/lib/request.test.ts`.

## 2. Shared text-input resolver (`utils/text-input.ts`)

- [x] 2.1 Create `utils/text-input.ts` with the API in design D1:
    - `TextInputIo`, `TextInputError`, `ProseSource`, `assertSingleSource`, `aliasedSource` and `readProse`;
    - `defaultTextInputIo`, an exported plain object so tests can `vi.spyOn` it, with:
        - `readFile` = `readFileSync(path, 'utf-8')`;
        - `readStdin` = `readFileSync(0, 'utf-8')`;
        - `stdinIsTTY` = `isatty(0)` from `node:tty`;
        - `hint` = `console.error`.

    Never access `process.stdin` (design D4).

- [x] 2.2 Implement the rules in `readProse` and its helpers:
    - Check exclusion by presence, before any read (design D3):
        - `Cannot use both <flag> and <fileFlag>`;
        - `aliasedSource` gives `Cannot use both --add and --body (--add is an alias of --body)`, or `Cannot use both --add and --body-file`.
    - Return an inline value verbatim. With `required: true`, an empty or whitespace-only inline value is an error naming the flag (design D5).
    - An empty path is an error: `<fileFlag> needs a path, or - for stdin`.
    - For `-`:
        - print the design D7 hint through `io.hint` only when `io.stdinIsTTY()` is true;
        - then call `io.readStdin()`;
        - map `EAGAIN` to the error in design D4.
    - For a path:
        - call `io.readFile(path)`;
        - map `ENOENT` to `File not found: <path>`;
        - map any other error to `Cannot read <fileFlag> <path>: <reason>`.
    - Strip exactly one leading U+FEFF from file and stdin text, never from inline text (design D6).
    - Reject empty or whitespace-only file and stdin text with the design D4 messages, which name the flag and the path or stdin. Never fall back to another source.
    - Do nothing else: no unescaping, no trimming, no line-ending changes.
- [x] 2.3 Add `utils/text-input.test.ts`. Use a fake `TextInputIo` whose `readFile` and `readStdin` throw unless the test expects them to be called. Cover:
    - inline text containing a literal backslash-n passes through unchanged;
    - file and stdin sources;
    - stdin is not read when the file flag is absent, or when the inline flag is given `-`;
    - inline plus file, and inline plus `-`, fail before any read, including when the inline value is `""`;
    - the alias messages;
    - an empty path (`--body-file ""`) is rejected without any read;
    - `File not found: <path>`, a directory (`EISDIR`) and `EAGAIN`;
    - BOM removal from file and stdin text, and no BOM removal for inline text;
    - CRLF and a trailing newline are kept;
    - empty, whitespace-only and BOM-only file and stdin text are rejected;
    - `required` rejects an empty or whitespace-only inline value with the design D5 message, and without `required` it is returned as `""`;
    - with no source at all, `readProse` returns `undefined` with and without `required`;
    - the hint is given only for `-` on a TTY, and only through `io.hint`.

## 3. Parser support (`utils/cli-args.ts` and the three parsers)

- [x] 3.1 Create `utils/cli-args.ts` with:
    - `splitOptionToken(arg)`, which splits `--name=value` at the first `=`;
    - the `StrictRule` type;
    - `checkStrictArgs(rule, typedOptions, positionals)`, which throws with the design D11 messages:
        - for an unknown option: the option, the command, an optional suggestion, the accepted options and the help pointer;
        - for an extra positional: the first extra argument plus the quoting guidance, or the `-` variant; a rule without a prose pair gives the first line only;
    - `suggestOption(name, rule)`, which tries in order: the prose-role mapping, a unique prefix, then the unique closest accepted option within `max(1, floor(len / 3))` edits.
- [x] 3.2 Add `utils/cli-args.test.ts`. Cover:
    - splitting `--a=b`, `--a=`, `--a=b=c`, `--a` and a non-option;
    - every row of the design D11 suggestion table, plus the three no-suggestion cases;
    - the unknown-option message names the option and the command and lists the accepted options;
    - the extra-argument message names the first extra argument and mentions quoting and the file flag, the `-` variant suggests `--<flag>-file -`, and a rule without a prose pair prints only the first line;
    - accepted input passes.
- [x] 3.3 Change the Jira `parseArgs` (`commands/jira.ts:114-167`):
    - Export it.
    - Split `--name=value`. Reject `=` on the boolean flags in design D9 with `Option --x does not take a value`.
    - Keep `--field` repeatable and `--limit` numeric in both forms.
    - Keep greedy value consumption for the space-separated form.
    - Record the typed option names for the strict check.
    - Add `'body-file'`, `'description-file'` and `'comment-file'` to `JiraOptions`.
- [x] 3.4 Change the Confluence `parseArgs` (`commands/confluence.ts:23-56`) the same way:
    - export it;
    - split `--name=value`, and reject `--json=…`;
    - keep `--limit` numeric;
    - record the typed option names.
- [x] 3.5 Change the Bitbucket `parseArgs` (`commands/bitbucket.ts:111-149`):
    - Split `--name=value` before the `FLAG_ALIASES` lookup, so `--src=x` sets `from`.
    - `BOOLEAN_FLAGS` reject `=`. `NUMBER_FLAGS` and `REPEATABLE_FLAGS` accept it.
    - Missing-value errors still name the alias as typed.
    - Record the typed option names.
- [x] 3.6 Add parser tests for `=value`:
    - Jira, in a new `commands/jira.test.ts`: `--add="Looks good"`, `--field=storyPoints=5`, `--body-file=-`, `list PROJ --limit=5` (a non-strict subcommand), and `--json=true` → error.
    - Confluence, in a new `commands/confluence.test.ts`: `--title="New Title"`, `create … --body-file=-`, and `--json=1` → error.
    - Bitbucket, in `commands/bitbucket.test.ts`: `--body="LGTM"`, `--src=feature/x`, `--var=FOO=bar`, `--line=10`, and `--draft=true` → error.

    The existing alias tests must keep passing.

## 4. Jira

- [x] 4.1 Add the Jira strict rule table from design D10, and call `checkStrictArgs` at the end of `parseArgs`.
    - `comment` rules are keyed by action: `edit`, `delete`, or anything else, which means a key (list or add).
    - `worklog` rules are keyed by `list`, `add`, `update` and `delete`. Any other worklog action matches no rule, so the handler's existing error still fires.
    - Each rule carries its prose pair, so the role-based suggestions work.
- [x] 4.2 `comment` add and list (`commands/jira.ts:637-669`):
    - Build the source with `aliasedSource` over `--body`, `--add` and `--body-file`.
    - Keep the issue-key check, and list the comments when no source is given.
    - Otherwise resolve with `readProse(…, { required: true })`, then:
        - with `--internal` / `--public`: call `addServiceDeskComment` with the text as typed;
        - otherwise: call `addComment` with `--visibility`.
    - Update the usage strings from `[--add "text"]` to the `--body` / `--body-file` forms.
- [x] 4.3 `comment edit` (`commands/jira.ts:590-616`): use the same source with `required: true`. When the key, the id or every body flag is missing, print `Error: Issue key, comment id, and --body or --body-file required` with a usage line showing `--body-file -`.
- [x] 4.4 `create` and `update` (`commands/jira.ts:469-570`):
    - Add `--description-file`, resolved after the existing required-argument checks and before `resolveFieldFlags`.
    - In `update`, the presence of either description flag counts for the "No update options provided" check, and that error's hint lists `--description-file`.
    - Inline `""` keeps today's meaning (design D5).
- [x] 4.5 `transition` (`commands/jira.ts:672-693`): add `--comment-file`, resolved after the `--to` check. Inline `""` is unchanged.
- [x] 4.6 `worklog add` and `worklog update` (`commands/jira.ts:1133-1175`): add `--comment-file`, resolved after the existing key, id and `--time` checks, and show it in both usage strings. Inline `""` is unchanged.
- [x] 4.7 `version-create` and `version-update` (`commands/jira.ts:790-847`):
    - Add `--description-file`, resolved after the existing `--project` / `--name` and version-id checks. The text is passed as a plain string, with no conversion.
    - The "No update options provided" hint lists `--description-file`.
    - Inline `""` is unchanged.
- [x] 4.8 Extend `commands/jira.test.ts` with handler tests.

    Setup:
    - partially mock `../jira/lib/client.ts` with `importOriginal`, because `jira/lib/formatters.ts` imports `adfToText` from it;
    - spy on `console.log` and `console.error`;
    - drive stdin through `vi.spyOn(defaultTextInputIo, 'readStdin' | 'stdinIsTTY')`;
    - write files at runtime under `mkdtempSync(join(tmpdir(), 'af-text-input-'))`, removed in `afterEach`.

    Cases:
    - comment:
        - `--body`, `--add`, a `--body-file` path and `--body-file -` each reach `addComment` with the exact text;
        - the hint goes to stderr only when `stdinIsTTY` is true;
        - `--add` with `--body` exits 1 without calling `addComment` or `getComments`;
        - `--add ""` exits 1 without calling either;
        - with no body flag, `getComments` is called;
        - `--internal --body-file <file>` calls `addServiceDeskComment(key, text, false)`, and `--public` passes `true`;
    - comment edit: `--body-file -` and `--add` reach `updateComment`; a missing body exits 1; `--internal` is rejected;
    - create: `--description-file -` reaches `createIssue`; `--description ""` is passed as `""`;
    - update:
        - `--description-file <file>` alone calls `updateIssue(key, { description: text })`;
        - `--description ""` is passed as `""`;
        - `--summary X --description-file missing.md` prints `File not found: missing.md` and does not call `updateIssue`;
    - transition: `--comment-file -` reaches `transitionIssue`; without `--to`, it exits 1 and `readStdin` is never called;
    - worklog add and update with `--comment-file`;
    - version-create and version-update with `--description-file`, passed as plain strings;
    - the "unchanged" rows of design D5 reach the client exactly as typed: `transition --comment ""`, `worklog add --comment ""`, `worklog update --comment ""`, `version-create --description ""` and `version-update --description ""` each pass `''`;
    - strict checks:
        - `comment --comment` suggests `--body` and `getComments` is not called;
        - `create --descripton` suggests `--description`;
        - `transition --body-file` suggests `--comment-file`;
        - the apostrophe-split argv `['comment', 'PROJ-1', '--add', 'Dont', 'merge', 'until', 'QAs done']` names `merge`;
        - `--json` is accepted.

- [x] 4.9 Extend `jira/lib/client.test.ts`, using its existing `fetch` stub, so the request bodies behind those "unchanged" rows are pinned too:
    - `updateIssue(key, { description: '' })` sends `fields.description: null`;
    - `transitionIssue(key, 'Done', { comment: '' })` sends no `update` property;
    - `updateWorklog(key, id, { comment: '' })` sends `comment: { type: 'doc', version: 1, content: [] }`;
    - `updateVersion(id, { description: '' })` sends `description: ''`, and `createVersion(project, name, { description: '' })` sends no `description`.
- [x] 4.10 Extend `integration.test.ts` with the end-to-end stdin case from design D14:
    - Start a local `http.createServer` on `127.0.0.1:0`.
    - Spawn `bun --no-env-file <abs path>/main.ts jira comment PROJ-1 --body-file -` with:
        - `stdio: ['pipe', 'pipe', 'pipe']`;
        - a `mkdtemp` cwd;
        - an env containing only `PATH`, `HOME` and fake `ATLASSIAN_BASE_URL` / `ATLASSIAN_EMAIL` / `ATLASSIAN_API_TOKEN` values that point at that server.
    - Write the lines `## Summary`, an empty line and `- First point`, joined by real newlines, to the child's stdin and always call `end()`. Node's `'pipe'` is a UNIX socket, and Bun reads it until the parent ends it, so a missing `end()` hangs the test (design D14). Assert:
        - exit 0;
        - exactly one `POST /rest/api/3/issue/PROJ-1/comment`;
        - its ADF has a level-2 heading `Summary` and a bullet list.
    - With stdin ignored (`/dev/null`), assert exit 1, no request, and stderr naming `--body-file`.

## 5. Confluence

- [x] 5.1 Add the Confluence strict rule table for `create`, `update` and `comment` (design D10), and call `checkStrictArgs` at the end of `parseArgs`.
- [x] 5.2 Replace `getBodyContent` (`commands/confluence.ts:61-74`) with `readProse` in `create` and `update`:
    - `--body` with `--body-file` is an error, even when `--body` is `""`;
    - `--body-file -` reads stdin;
    - `create --body ""` still creates an empty-bodied page;
    - `update --body ""` still leaves the body unchanged and does not count as an update option;
    - empty file or stdin text is an error;
    - the "No update options provided" hint still lists `--body-file`.
- [x] 5.3 `comment` (`commands/confluence.ts:339-359`):
    - Use `aliasedSource` over `--body`, `--add` and `--body-file` with `required: true`.
    - When every body flag is missing, print `Error: --body or --body-file required. Usage: af confluence comment <page-id> --body "text"`.
- [x] 5.4 Extend `commands/confluence.test.ts` with handler tests. Partially mock `../confluence/lib/client.ts` and use the same stdin and file technique as 4.8.
    - comment:
        - `--body`, `--body-file -` and `--add` reach `addComment`;
        - `--add` with `--body-file` exits 1;
        - a missing body exits 1;
        - `--body ""` exits 1;
        - `--comment` suggests `--body`;
        - `--body Looks good` names `good`;
        - `--body "Looks good" --json` is accepted and prints JSON;
    - create:
        - `--body-file -` reaches `createPage`;
        - `--body x --body-file f` exits 1 without calling `createPage`;
        - an empty file exits 1;
        - `--body-flie` suggests `--body-file`;
    - update:
        - `--body-file -` reaches `updatePage` with `bodyMarkdown`;
        - `--title New --body ""` calls `updatePage(id, { title: 'New' })` without `bodyMarkdown`.

## 6. Bitbucket

- [x] 6.1 Add the Bitbucket strict rule table for `pr create`, `pr update`, `pr comment <action>` and `pr task <action>` (design D10).
    - Call `checkStrictArgs` at the end of the exported `parseArgs`.
    - `--json`, `--workspace` and `--repo` are global.
    - `pr create` lists the typed branch aliases.
    - Any other subcommand or action matches no rule.
- [x] 6.2 Replace `readBody` and `readDescription` (`commands/bitbucket.ts:252-269`) with `readProse`:
    - `required: true` for every comment and task body: `pr comment add`, `pr comment update`, `pr task add` and `pr task update`;
    - `pr task update` still treats a missing body as "no body change": `readProse` returns `undefined` when neither flag is given, whatever `required` says (design D1), while a supplied empty inline value is an error;
    - descriptions do not pass `required`, so `""` is still sent.

    Drop the `readFileSync` import if it is no longer used.

- [x] 6.3 Extend `commands/bitbucket.test.ts`.

    Setup: add `addComment`, `updateComment`, `addTask`, `updateTask`, `createPullRequest`, `updatePullRequest`, `getCurrentBranch` and `getRepository` to the `vi.mock` client factory, and reset them in each new describe's `beforeEach`. Type the spy callbacks, so the 6 existing type errors in this file do not grow.

    `parseArgs` cases:
    - `--add` on `pr comment add` throws and suggests `--body`;
    - `--body` on `pr create` throws and suggests `--description`;
    - `--body Looks good` throws, naming `good`;
    - `pr update 42 --draft` throws, naming `--draft` and `pr update`;
    - the global options plus the branch aliases pass;
    - `pr list` with an unknown option still parses.

    Handler cases:
    - `pr comment add 42 --body-file -` posts the stdin text;
    - `--body x --body-file -` exits 1 and never reads stdin;
    - `--body-file missing.md` prints `File not found: missing.md`;
    - `pr task add 42 --body-file -` with empty stdin exits 1 without calling `addTask`;
    - `pr comment add 42 --body ""` exits 1;
    - `pr task update 42 7 --body "" --resolved` exits 1 without calling `updateTask`, while `pr task update 42 7 --resolved` still calls it with no body;
    - `pr update 42 --description ""` calls `updatePullRequest` with description `''`;
    - `pr create --title T --from a --to b --description-file -` passes the stdin text as the description.

## 7. Help

- [x] 7.1 Update `showJiraHelp` (`commands/jira.ts:172-366`) as design D12 describes:
    - the `comment` COMMANDS row;
    - COMMENT OPTIONS with `--body`, `--body-file <path|->`, `--add` (alias), `--visibility`, and `--internal` / `--public`, whose text is sent as typed and rendered by JSM as wiki markup, not markdown;
    - `--description-file` on create and update, and `--comment-file` on transition and worklog, described as "markdown, converted to ADF";
    - the version `--description` / `--description-file`, described as "plain text, sent as typed";
    - `--limit` moved to LIST / SEARCH OPTIONS;
    - the MULTI-LINE TEXT section;
    - the `--add` examples switched to `--body`.

    The help is a template literal. Write `\\n` so the output shows `\n`, escape backticks, and give the five example lines no leading spaces in the source.

- [x] 7.2 Update `showConfluenceHelp` (`commands/confluence.ts:79-154`):
    - `comment` with `--body`, `--body-file <path|->` and `--add` (alias);
    - fix the "(omit to list comments)" text: listing is `comments`;
    - `-` on `create` and `update` `--body-file`;
    - "markdown, converted to ADF";
    - `--limit` moved out of the global OPTIONS to the commands that read it (design D12);
    - the MULTI-LINE TEXT section with `af confluence comment 12345 --body-file - <<'AF_BODY'`.
- [x] 7.3 Rename Bitbucket's `showHelp` (`commands/bitbucket.ts:151-250`) to an exported `showBitbucketHelp`, and update it:
    - `--body-file` and `--description-file` take `<path|->`;
    - a note that the text is sent as typed and rendered as markdown;
    - the MULTI-LINE TEXT section with `af bb pr comment add 42 --body-file - <<'AF_BODY'`.
- [x] 7.4 Wire the full references into `commands/help.ts`:
    - Export `showJiraHelp` from `commands/jira.ts` and `showConfluenceHelp` from `commands/confluence.ts` (`showBitbucketHelp` is exported in 7.3), and import all three in `commands/help.ts`.
    - Make `showCommandHelp` delegate `jira`, `confluence`, `bitbucket` and `bb` to the product renderers.
    - Delete the abbreviated `HELP_CONTENT` entries for those four keys (`commands/help.ts:71-140`).

    Leave the general help list and `router.ts` unchanged.

- [x] 7.5 Correct the `addServiceDeskComment` docstring (`jira/lib/client.ts:300-304`) to say that JSM renders the body as wiki markup. This is a comment-only change.
- [x] 7.6 Add `commands/help.test.ts`, using a `console.log` spy.
    - For each of `jira`, `confluence` and `bitbucket`, `handleHelp(name)` output equals the product handler's `['--help']` output.
    - `handleHelp('bb')` equals `handleHelp('bitbucket')`.
    - The Jira output contains `--body-file`, `--description-file`, `--comment-file`, `--add`, `wiki markup` and `plain text`.
    - Each product's output contains its five example lines, consecutively and at column 0: the command line, `## Summary`, an empty line, `- First point` and `AF_BODY`.

## 8. Documentation

- [x] 8.1 Update `README.md` as design D13 describes.
    - **Jira:** add a "Multi-line text" subsection. Switch the comment examples to `--body`.
    - **Confluence:** add a `--body-file -` heredoc example, and change the comment example to `--body`.
    - **Bitbucket:** add a `--body-file -` heredoc example.
    - **Everywhere:** note that prose commands reject unknown options, and that options also accept `--flag=value` on every Jira, Confluence and Bitbucket subcommand.

    Print every heredoc example flush-left inside its fence.

- [x] 8.2 Update `CLAUDE.md`:
    - **Jira Workflow:** the "Comments" bullet covers `--body` / `--body-file` (`-` is stdin), the `--add` alias, and JSM `--internal` / `--public` as wiki markup. Add a "Multi-line text" bullet with the heredoc and the reason, and the strict-parsing note.
    - **Confluence block:** `comment <page-id> --body …`, and `--body-file -` on `create`, `update` and `comment`.
    - **Bitbucket block:** `--body-file` and `--description-file` accept `-`, and the PR prose commands reject unknown options.
    - **Project Structure tree:** add `utils/text-input.ts` and `utils/cli-args.ts`.
    - **"Adding New Commands":** prose flags get a `-file` twin through `readProse`, and prose commands declare a strict rule.
- [x] 8.3 Run `bun run spell:check`. Add genuinely new words to `.cspell.json`, or to a file-local `cspell:words` comment.

## 9. Verification

- [x] 9.1 Run `bun run test`, never `bun test`, and fix every failure.
- [x] 9.2 Run `bun run lint`, `bun run format:check` and `bun run spell:check`.
- [x] 9.3 Run `npx tsc --noEmit --pretty false`, and count with `grep -c 'error TS'` as in 1.2. Check that:
    - the error count is not above the 1.2 baseline;
    - `commands/bitbucket.test.ts` still has exactly 6 errors;
    - no error is in a new file or in a non-test file this change touches.
- [x] 9.4 Run `openspec validate add-multiline-body-input --strict`.
- [x] 9.5 Check the package contents with `npm pack --dry-run`. It must list `utils/text-input.ts` and `utils/cli-args.ts`, and no `*.test.ts`.
- [x] 9.6 Run a manual heredoc smoke test in zsh 5.9 and macOS `/bin/bash` 3.2, plus bash 5 if one is available. Never use a live system.
    - **Setup.**
        - Work in a `mktemp -d` directory outside the repository, which has no `.env`.
        - Start a throwaway local fake Atlassian server on `127.0.0.1` that records every request and answers it with minimal JSON.
        - Run af through the real launcher (`<repo>/af`) with `env -i PATH="$PATH" HOME="$HOME" ATLASSIAN_BASE_URL=http://127.0.0.1:<port> ATLASSIAN_EMAIL=smoke@example.invalid ATLASSIAN_API_TOKEN=fake`.
    - **Commands**, each feeding a quoted `<<'AF_BODY'` heredoc to `--body-file -`:
        - `af jira comment PROJ-1`;
        - `af jira comment PROJ-1 --internal`;
        - `af confluence comment 12345`.
    - **Bitbucket.** Its API host is fixed, so run `bun --no-env-file --preload <stub.ts> <repo>/main.ts bb pr comment add 42 --workspace ws --repo r --body-file -` with fake `BITBUCKET_*` values. `<stub.ts>` replaces `globalThis.fetch` with a recorder that answers every request itself and never forwards.
    - **The heredoc body** contains:
        - a `## Summary` heading and a bullet list;
        - inline code;
        - `` `touch SHOULD_NOT_EXIST` ``;
        - `$HOME` and `$(echo nope)`;
        - an apostrophe;
        - `C:\new\notes`;
        - a trailing backslash;
        - a TAB.
    - **Expected results.**
        - The JSM `body` and the Bitbucket `content.raw` equal the heredoc text byte for byte.
        - The Jira and Confluence ADF bodies have the heading and the list. Their text nodes keep `$HOME`, `$(echo nope)`, `C:\new\notes`, the apostrophe, the backslash and the TAB literally. The trailing backslash survives in the text node. This holds for `fix-adf-converter-hang`'s converter, which this change builds on; `replace-markdown-adf-converter` comes later in the agreed order.
        - `SHOULD_NOT_EXIST` was not created.
        - `af jira comment PROJ-1 --body-file - </dev/null` exits 1 and records no request. Redirect explicitly: without a heredoc or `</dev/null`, stdin in a terminal is the terminal, so af prints the hint and waits instead (that case is 9.7).
    - **Cleanup.** Delete the temp directory. Commit nothing from it.
- [x] 9.7 Check stdin interactively in a real terminal, against the same fake server. `af jira comment PROJ-1 --body-file -` prints the hint on stderr, waits for input, and posts the typed text after Ctrl-D on an empty line.

## 10. Follow-ups from review and adversarial verification

A review per product, then an adversarial pass (every spec scenario run through the real CLI, parser fuzzing against an independent model, an old-versus-new diff over 150+ command lines, and a code review), confirmed the items below.

- [x] 10.1 Report a trailing value-less option after the strict check in all three parsers, so `af jira comment PROJ-1 --comment` gets "Unknown option … Did you mean --body?" instead of "requires a value".
- [x] 10.2 Validate `--field` / `--field-json` shapes (`validateFieldFlags` in `jira/lib/fields/resolve-flags.ts`) before reading `--description-file` in Jira `create` and `update`, as `transition` already does. Tested so that the stdin reader is never called.
- [x] 10.3 Report a path through a regular file (`ENOTDIR`) as `File not found: <path>`.
- [x] 10.4 Look up help topics by own key, so `af help __proto__`, `constructor`, `valueOf` and `hasOwnProperty` report an unknown command instead of crashing.
- [x] 10.5 Suggest nothing for a bare `--`.
- [x] 10.6 Complete the BREAKING list (proposal and design Migration Plan) for empty or whitespace-only inline bodies, and note the strict option checking in the README's Confluence and Bitbucket sections.
- [x] 10.7 Add the strict-parsing and `--name=value` note to the Confluence and Bitbucket help, as on Jira.
- [x] 10.8 Re-run 9.1-9.6.

<!-- cspell:words descripton flie EISDIR EAGAIN ENOENT ENOTDIR FEFF isatty Dont mktemp -->
