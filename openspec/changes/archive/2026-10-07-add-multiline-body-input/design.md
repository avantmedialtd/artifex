## Context

Agents post broken Jira comments because the only way to give `af jira` prose is an inline argument, and `"…\n…"` in double quotes reaches af as a backslash and an `n` (see the proposal). This change adds file and stdin input to every prose flag, tightens argument parsing on the commands that take prose, and fixes the help agents are told to read.

Current behaviour that shapes the design, with line numbers at HEAD `b2ad5f1`:

- The Jira parser is greedy and has no schema. Any `--x` takes the next argv as its value and is stored under `x` (`commands/jira.ts:148-158`). `comment` adds only when `options.add` is truthy and otherwise lists (`commands/jira.ts:644`, `:665-667`).
    - **Consequence:** `--body`, `--body-file`, `--comment`, `--add ""` and stray positionals all list the comments and exit 0. Strict checking is needed on top of new flags.
- `--add=text` becomes the option `add=text` (`commands/jira.ts:149`). The Confluence (`commands/confluence.ts:23-56`) and Bitbucket (`commands/bitbucket.ts:111-149`) parsers do the same. Only Sonar handles `--project=` and rejects unknown options (`commands/sonar.ts:81-84`).
    - **Consequence:** `--name=value` needs explicit support in three parsers.
- Bitbucket already has `readBody` / `readDescription` (`commands/bitbucket.ts:252-269`): presence-based mutual exclusion with the error `Cannot use both --body and --body-file`, and a raw `ENOENT` for a missing file. Confluence's `getBodyContent` (`commands/confluence.ts:61-74`) lets `--body` silently win and reports `File not found: <path>`.
    - **Consequence:** One shared resolver replaces both, taking Bitbucket's exclusion and Confluence's message.
- Prose sinks differ. Comments, issue descriptions, transition and worklog comments, Confluence pages and comments go through `textToAdf` (`jira/lib/client.ts:158,212,272,286,497,512,639`; `confluence/lib/client.ts:89,130,195`). JSM `--internal` / `--public` posts a plain string that JSM renders as wiki markup (`jira/lib/client.ts:305-325`; its docstring at `:303` wrongly says "plain text"). Version descriptions are plain strings (`jira/lib/client.ts:863-865,897-899`). Bitbucket sends raw markdown (`bitbucket/lib/client.ts:226,253,366,401,469,499`).
    - **Consequence:** The resolver must be sink-agnostic. Help must say per flag what the text becomes.
- Inline `""` already means different things: `update --description ""` clears via `null` (`jira/lib/client.ts:211-213`); `transition`, `worklog add`, `create` and `version-create` skip it (`:638`, `:497`, `:157`, `:863`); `worklog update` and `version-update` send it (`:512`, `:897`); `comment --add ""` lists (`commands/jira.ts:644`).
    - **Consequence:** Empty-value rules are per command (D5), not global.
- `af jira --help` and `af help jira` go to `handleHelp('jira')` (`router.ts:46-48`, `:151-153`), which prints the abbreviated entry in `commands/help.ts:71-95`; it never mentions `comment`. `af jira` and `af jira <sub> --help` print the full `showJiraHelp` (`commands/jira.ts:172-366`, `:377-380`). `af bb --help` prints the alias stub (`commands/help.ts:136-140`), whose only example is `af bb --help` itself.
    - **Consequence:** The help agents read must become the full reference (D12).
- Measured under Bun 1.4.2 with zsh 5.9 and macOS bash 3.2.57: `readFileSync(0, 'utf-8')` reads a pipe (FIFO), a quoted heredoc (a regular file in both shells) and `/dev/null` (empty). On a terminal it blocks until Ctrl-D. A UTF-8 BOM is kept. Under Node, but not Bun, touching `process.stdin` first makes `readFileSync(0)` throw `EAGAIN` on a slow pipe.
    - **Consequence:** Read stdin with `readFileSync(0)`, detect a terminal with `isatty(0)`, never touch `process.stdin` (D4).
- In the Claude Code Bash tool, fd 0 is `/dev/null` unless the command contains a heredoc, in which case it is a socket that never reaches end-of-file (exploration evidence). Some harness flows only allow inline bodies (Claude Code's PR skill refuses `--body-file`).
    - **Consequence:** Stdin is read only on an explicit `-`. Empty stdin is an error. Inline input must keep working unchanged.
- `textToAdf` hangs on CRLF headings and marker-only headings today.
    - **Consequence:** Depends on `fix-adf-converter-hang`, which normalizes CRLF and BOM inside the converter.
- `commands/bitbucket.test.ts` mocks the client module with an explicit function list. There is no `commands/jira.test.ts` and no Confluence test. Vitest runs under Node, not Bun: `bun run test` runs `vitest run`, whose binary starts with `#!/usr/bin/env node` (measured: `process.release.name` is `node` and `Bun` is undefined inside a test). Prettier (`endOfLine: 'lf'`) checks every file outside `.prettierignore`, which lists `openspec/`. CSpell (`bun run spell:check`) checks `openspec/` too; its `ignorePaths` cover only `node_modules`, build output and a few config files.
    - **Consequence:** Readers must be injectable. CRLF and BOM fixtures are generated at runtime, not committed.

## Goals / Non-Goals

**Goals:**

- Every prose flag has a `-file` twin that takes a path or `-` (stdin). The text arrives byte-for-byte, apart from a leading BOM on file and stdin input.
- One resolver gives identical rules and messages on Jira, Confluence and Bitbucket: mutual exclusion, `File not found: <path>`, empty input, and the interactive hint.
- On prose commands, wrong flag names and unquoted words fail loudly with a usable hint, instead of being ignored.
- `--name=value` works on the three parsers.
- `af jira --help`, `af help jira` and their Confluence and Bitbucket equivalents print the full reference, which shows the safe multi-line form.

**Non-Goals:**

- Detecting or unescaping literal `\n` (user decision).
- Other content checks, such as the leaked-`AF_BODY`-line check the exploration suggested, are out of scope for this change.
- The credential-leak and inline-`-` checks remain Open Questions.
- Changing how JSM renders `--internal` / `--public` bodies. The `sd.public.comment` route stays ruled out (`openspec/changes/archive/2026-06-16-expand-jira-api-coverage/design.md:87`). The known silent drops on that path are also left alone: `--visibility` is ignored, and `--public` wins over `--internal`.
- `-file` twins for single-line flags (`--summary`, `--title`, `--name`, Confluence `--message`), and `--field name=@file`.
- Strict parsing on subcommands that take no prose, a shared declarative parser, or a POSIX `--` end-of-options marker.
- Rejecting option values that begin with `-` or `--`. `--body --json` still posts `--json`; prose belongs in a file or on stdin.
- Validating UTF-8 or detecting binary files.

## Decisions

### D1. One resolver: `utils/text-input.ts`

A new module owns prose input for every command. `utils/` is already in the `package.json` `files` allowlist.

```ts
export interface TextInputIo {
    readFile(path: string): string; // readFileSync(path, 'utf-8'); throws Node errors (ENOENT, EISDIR, …)
    readStdin(): string; // readFileSync(0, 'utf-8')
    stdinIsTTY(): boolean; // isatty(0) from node:tty — never process.stdin (D4)
    hint(line: string): void; // console.error
}
export const defaultTextInputIo: TextInputIo; // a plain object, so tests can vi.spyOn it

export class TextInputError extends Error {}

export interface ProseSource {
    flag: string; // the inline flag as typed: '--body', or '--add' when the alias was used
    value?: string; // inline value; undefined when absent
    fileFlag: string; // '--body-file'
    file?: string; // path or '-'; undefined when absent
}

/** D3: throws when both inline and file are present. Never reads anything. */
export function assertSingleSource(src: ProseSource): void;

/** D2–D6: undefined when neither is given; inline value verbatim; else file/stdin text. */
export function readProse(
    src: ProseSource,
    opts?: { required?: boolean }, // required: an empty or whitespace-only inline value is an error (D5)
    io?: TextInputIo,
): string | undefined;

/** D3: merges --body and its --add alias into one ProseSource; throws when both are given. */
export function aliasedSource(
    primary: { flag: string; value?: string }, // --body
    alias: { flag: string; value?: string }, // --add
    file: { flag: string; value?: string }, // --body-file
): ProseSource;
```

The functions are synchronous. Handlers are async, but a blocking read is fine for a one-shot CLI, and `readFileSync(0)` is what was measured. `readProse` calls `assertSingleSource` itself, so a handler that forgets the early call is still safe.

`required` only governs an inline value that is present: it does not make a source mandatory. With no source at all, `readProse` returns `undefined` whatever `required` says, and the handler decides what absence means (list the comments, print a usage error, or leave the field alone). That is why Bitbucket `pr task update`, whose body is optional, still passes `required: true`.

Rejected alternatives:

- **Per-command readers.** This is the status quo, and it already drifted: three different empty-value rules, two missing-file messages and two exclusion rules.
- **Async `Bun.stdin.text()`.** Vitest runs under Node, and nothing is gained over a synchronous read.
- **Auto-detecting stdin when it is not a TTY**, as jira-cli does. It hangs on agent sockets (jira-cli#948) and silently yields `''` on `/dev/null`.

### D2. Sources and the meaning of `-`

- **Inline values** are used exactly as received. The resolver never touches them.
- **A `-file` value** is a path resolved against `process.cwd()`. The `af` launcher spawns Bun with the caller's cwd and `stdio: 'inherit'` (`af:24-26`), so relative paths and stdin both reach the real process.
- **`-` means stdin only on a `-file` twin**, following gh, git, glab and linear-cli. `--body -` stays a literal `-` (Open Questions). A file literally named `-` is read as `./-`.
- **An empty path** (`--body-file ""`) is an error: `--body-file needs a path, or - for stdin`.
- **Each prose command has exactly one prose input**, so stdin is read at most once per invocation, and no cross-flag guard is needed.

Rejected alternatives:

- **`--stdin` or `-F`.** Kept as an Open Question from the proposal.
- **`@file` values.** No af flag uses that convention, and `@` is legitimate text.

### D3. Mutual exclusion and the `--add` alias

- **Presence decides.** A flag is present when it was given at all, even with `""`. Giving both members of a pair fails with `Cannot use both --<flag> and --<flag>-file` (Bitbucket's existing wording, `commands/bitbucket.ts:253-255`).
- **The check runs before anything is read.** Stdin is never consumed for a command that is going to fail.
- **`--add` is resolved in the handler, not at parse time.** Jira `comment` add and edit, and Confluence `comment`, call `aliasedSource({ flag: '--body', value: options.body }, { flag: '--add', value: options.add }, { flag: '--body-file', value: options['body-file'] })`.
    - `--add` with `--body` fails with `Cannot use both --add and --body (--add is an alias of --body)`.
    - `--add` with `--body-file` fails with `Cannot use both --add and --body-file`.

Rejected alternatives:

- **A parse-time alias** in the style of Bitbucket's `FLAG_ALIASES`. Confluence `label --add` means label names, so a global alias would break it. It would also lose the flag name the user typed, which the error messages need.
- **Last-one-wins between `--add` and `--body`.** It hides exactly the kind of mistake this change exists to surface.

### D4. Reading rules and errors

`readProse` works through these steps for file and stdin sources:

1. **A path that does not exist** fails with `File not found: <path>` on every command. The code catches `ENOENT` instead of calling `existsSync` first, which avoids a race.
2. **Any other read error** fails with `Cannot read --body-file <path>: <reason>`, for example for a directory.
3. **Stdin on a terminal.** When the file value is `-` and `isatty(0)` is true, the hint from D7 is printed, then `readFileSync(0, 'utf-8')` is called. `process.stdin` is never accessed: under Node that switches a pipe to non-blocking mode, and `readFileSync(0)` then throws `EAGAIN` (measured). If `EAGAIN` ever surfaces anyway, it is reported as `Cannot read stdin for --body-file: …; pass a file path instead`.
4. **A leading U+FEFF is removed** (D6).
5. **Empty or whitespace-only content** fails without falling back to another source:
    - `--body-file -: no text on stdin. Pipe the text in, or use a quoted heredoc: --body-file - <<'AF_BODY'`
    - `--body-file notes.md: the file contains no text`

All of these are `TextInputError`s. The handlers already catch errors and exit 1. In `--json` mode, Jira and Confluence print `{"error": …}` to stderr (`commands/jira.ts:1312-1320`).

### D5. Empty inline values

File and stdin content is never allowed to be empty (D4). For inline values, each command keeps its current meaning, except where today's behaviour is a silent no-op, or a request that cannot succeed, on a body the command requires.

| Command                                                          | `""` inline today                            | After this change         |
| ---------------------------------------------------------------- | -------------------------------------------- | ------------------------- |
| Jira `comment <key>` `--body` / `--add` (platform and JSM)       | lists the comments, exit 0                   | **error** (required body) |
| Jira `comment edit` `--body` / `--add`                           | sends an empty ADF doc                       | **error** (required body) |
| Jira `create --description`                                      | no description                               | unchanged                 |
| Jira `update --description`                                      | clears (`null`)                              | unchanged                 |
| Jira `transition --comment`, `worklog add --comment`             | no comment                                   | unchanged                 |
| Jira `worklog update --comment`                                  | sends an empty ADF doc, clearing the comment | unchanged                 |
| Jira `version-create --description`                              | no description                               | unchanged                 |
| Jira `version-update --description`                              | clears (`""`)                                | unchanged                 |
| Confluence `comment` `--body` / `--add`                          | error (`--add is required`)                  | error (new wording)       |
| Confluence `create --body`                                       | empty page body                              | unchanged                 |
| Confluence `update --body`                                       | ignored; the body is left unchanged          | unchanged                 |
| Bitbucket `pr comment add/update`, `pr task add/update` `--body` | sends `content.raw: ""`                      | **error** (required body) |
| Bitbucket `pr create/update --description`                       | sends `""`; on update this clears it         | unchanged                 |

`required: true` also rejects whitespace-only inline values, which `textToAdf` would turn into an empty document. Comment and task bodies have no "clear" meaning: you delete a comment or task instead, so an empty one is always a mistake. Descriptions and worklog or transition comments do have one, and scripts may rely on it.

The error names the flag as typed and its file twin, since the resolver does not know what the text is for: `--add is empty. Give the text, or use --body-file (a path, or - for stdin)`.

### D6. No transformation except the BOM

The resolver performs none of these:

- interpreting escapes (the user decision);
- trimming;
- normalizing line endings;
- dropping the trailing newline a heredoc always adds.

It makes exactly one change: a single leading U+FEFF is removed from file and stdin text.

- **The BOM.** It is an encoding marker, not content. Bun keeps it (measured), and it turns a leading `## Title` into literal text on every markdown sink, not just ADF ones. `fix-adf-converter-hang` strips it inside `textToAdf`, but Bitbucket, JSM and version descriptions never reach the converter.
- **CRLF.** This is left to the sinks. ADF sinks normalize it in `textToAdf` (`fix-adf-converter-hang`); Bitbucket's markdown and JSM's wiki markup accept CRLF.
- **The trailing newline.** It is invisible in every sink.

The proposal's "never otherwise altered" wording is updated to name the BOM exception.

Rejected alternative: **normalizing CRLF in the resolver.** It would make the "verbatim" guarantee harder to state, for no visible gain.

### D7. Interactive hint

When the source is `-` and stdin is a terminal, the CLI prints one line to stderr before reading:

`Reading --body-file from stdin. Type the text, then press Ctrl-D on an empty line.`

No hint is printed for pipes, files or `/dev/null`. It never goes to stdout, so `--json` output stays parseable. That is also why it uses `console.error` and not `warn()`, which writes to stdout (`utils/output.ts:54-56`).

### D8. Order of operations in every prose handler

1. Parse, then apply the strict checks (D9, D10).
2. Run the command's existing required-argument checks, plus `assertSingleSource` / `aliasedSource`. Presence of a `-file` flag counts as "an update option was given", so `update`'s "No update options provided" check runs without reading.
3. Resolve input with `readProse`. This is the only step that may read a file or stdin.
4. Make the network calls. This includes read-only lookups such as the field registry, the current Confluence page and the transition list.

So `af jira transition KEY --comment-file -` without `--to` fails before stdin is read. An input error also aborts the whole command: `update --summary X --description-file missing.md` changes nothing.

### D9. `--name=value` in the three parsers

A shared `splitOptionToken(arg)` in `utils/cli-args.ts` splits `--name=value` at the first `=`. The value may be empty, and it may contain `=`.

- **Value-taking options** use the inline value and do not consume the next argv. This covers numeric options (`--limit=5`, `--line=10`), repeatable ones (`--field=storyPoints=5`, `--var=FOO=bar`) and Bitbucket's aliases (`--src=feature/x` normalizes to `--from`).
- **Boolean options** written with `=` throw `Option --json does not take a value`. The boolean sets are:
    - Jira: `--json`, `--released`, `--unreleased`, `--refresh`, `--verbose`, `--clear-parent`, `--internal`, `--public`;
    - Confluence: `--json`;
    - Bitbucket: its existing `BOOLEAN_FLAGS`.
- **Every subcommand gets this,** strict or not. `--x=y` used to be stored as the option `x=y` and could swallow the next token, so supporting it only removes failure modes.

Each parser also records the option names exactly as typed, before alias normalization and without `=value`. The strict check needs them.

### D10. Strict checking: scope, placement and rules

- **Placement.** Each product's `parseArgs` runs the strict check after its token loop. Jira's and Confluence's `parseArgs` become exported, like Bitbucket's already is, so tests can call them directly. Errors throw, and the handlers' existing `parseArgs` try/catch prints `Error: …` to stderr and returns 1, before any input is read or request sent. As with today's parse errors, the message is plain text even with `--json`.
- **Rules are data.** Each command module declares a table that maps a subcommand, plus its action where one applies, to a `StrictRule`:

    ```ts
    interface StrictRule {
        command: string; // e.g. 'af jira comment edit'
        options: string[]; // accepted options as typed, globals and aliases included
        maxPositionals: number;
        prose?: { inline: string; file: string };
    }
    ```

    `maxPositionals` counts the positional arguments after the product's subcommand, so `jira comment edit KEY ID` has 3. Too few positionals are left to the handlers' existing messages. An unknown action, such as `worklog frobnicate`, matches no rule, so the handler's existing "requires an action" error still fires. Subcommands without a rule keep today's lenient behaviour.

- **Global options.** `--json` is global for Jira and Confluence. Bitbucket's globals are `--json`, `--workspace` and `--repo`. `--limit` is not global: no strict command reads it, and the Jira and Confluence help move it out of their global OPTIONS (D12).
- **Repeated options** keep last-one-wins (Bitbucket spec "Later flag wins").

The rule tables, derived from what each handler reads and what its help documents:

| Command                                                    | Accepted options (besides the globals)                                                                                                                                                        | Max positionals |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| jira `comment <key>` (list / add)                          | `--body` `--body-file` `--add` `--visibility` `--internal` `--public`                                                                                                                         | 1               |
| jira `comment edit <key> <id>`                             | `--body` `--body-file` `--add` `--visibility`                                                                                                                                                 | 3               |
| jira `comment delete <key> <id>`                           | —                                                                                                                                                                                             | 3               |
| jira `create`                                              | `--project` `--type` `--summary` `--description` `--description-file` `--priority` `--labels` `--parent` `--estimate` `--fix-version` `--affected-version` `--field` `--field-json`           | 0               |
| jira `update <key>`                                        | `--summary` `--description` `--description-file` `--priority` `--labels` `--estimate` `--remaining` `--fix-version` `--affected-version` `--parent` `--clear-parent` `--field` `--field-json` | 1               |
| jira `transition <key>`                                    | `--to` `--resolution` `--comment` `--comment-file` `--field`                                                                                                                                  | 1               |
| jira `worklog list <key>`                                  | —                                                                                                                                                                                             | 2               |
| jira `worklog add <key>`                                   | `--time` `--started` `--comment` `--comment-file`                                                                                                                                             | 2               |
| jira `worklog update <key> <id>`                           | `--time` `--started` `--comment` `--comment-file`                                                                                                                                             | 3               |
| jira `worklog delete <key> <id>`                           | —                                                                                                                                                                                             | 3               |
| jira `version-create`                                      | `--project` `--name` `--description` `--description-file` `--start-date` `--release-date` `--released`                                                                                        | 0               |
| jira `version-update <id>`                                 | `--name` `--description` `--description-file` `--start-date` `--release-date` `--released` `--unreleased`                                                                                     | 1               |
| confluence `create`                                        | `--space` `--title` `--body` `--body-file` `--parent` `--status`                                                                                                                              | 0               |
| confluence `update <id>`                                   | `--title` `--body` `--body-file` `--status` `--message`                                                                                                                                       | 1               |
| confluence `comment <id>`                                  | `--body` `--body-file` `--add`                                                                                                                                                                | 1               |
| bb `pr create`                                             | `--title` `--description` `--description-file` `--from` `--source` `--src` `--to` `--destination` `--dest` `--reviewers` `--draft`                                                            | 1               |
| bb `pr update <id>`                                        | `--title` `--description` `--description-file` `--reviewers`                                                                                                                                  | 2               |
| bb `pr comment list <pr>`                                  | `--resolved` `--unresolved`                                                                                                                                                                   | 3               |
| bb `pr comment add <pr>`                                   | `--body` `--body-file` `--file` `--line` `--reply-to`                                                                                                                                         | 3               |
| bb `pr comment update <pr> <cid>`                          | `--body` `--body-file`                                                                                                                                                                        | 4               |
| bb `pr comment get / delete / resolve / reopen <pr> <cid>` | —                                                                                                                                                                                             | 4               |
| bb `pr task list <pr>`                                     | `--resolved` `--unresolved`                                                                                                                                                                   | 3               |
| bb `pr task add <pr>`                                      | `--body` `--body-file` `--on-comment`                                                                                                                                                         | 3               |
| bb `pr task update <pr> <tid>`                             | `--body` `--body-file` `--resolved` `--unresolved`                                                                                                                                            | 4               |
| bb `pr task delete <pr> <tid>`                             | —                                                                                                                                                                                             | 4               |

The prose pair for each command follows the table: `--body` / `--body-file` for comment and task bodies and Confluence pages; `--description` / `--description-file` for issue, version and PR descriptions; `--comment` / `--comment-file` for transitions and worklogs.

Every action of Jira `comment` and `worklog` is covered, and likewise every action of Bitbucket `pr comment` and `pr task`. Listing comments is the same invocation as adding one without a body flag, which is exactly where the silent no-op lived. Covering the delete actions costs one table row each and keeps the rule simple: the whole subcommand is strict.

Rejected alternatives:

- **Strict parsing everywhere.** It would break scripts on read-only commands, beyond what the proposal promises.
- **A declarative parser rewrite** shared by all products. It has a larger blast radius than this change needs. The rule tables are the first step toward one.
- **Checking inside each handler case.** That scatters the rules across files and runs after side effects like lazy imports.

### D11. Error messages and suggestions

An **unknown option** produces three lines:

```
Error: Unknown option --comment for 'af jira comment'. Did you mean --body?
Accepted options: --body, --body-file, --add, --visibility, --internal, --public, --json
Run 'af jira --help' for usage.
```

The suggestion is the first of these rules that applies. When none applies, the message just lists the accepted options.

1. **Prose-role mapping.** The unknown name is a prose flag of another command (`--body`, `--add`, `--comment`, `--description`, `--desc`, `--message`, `--text`, `--note`), and the rule has a prose pair: suggest the rule's inline flag. File-role names (`--body-file`, `--comment-file`, `--description-file`, `--add-file`, `--file`, `--message-file`, `--text-file`) suggest the rule's file flag. An accepted name never reaches this step, so Confluence `update --message` and Bitbucket `comment add --file` are unaffected.
2. **Prefix.** Exactly one accepted option starts with the typed name, for example `--reply` → `--reply-to`.
3. **Near-miss spelling.** The accepted option has the uniquely smallest edit distance, and that distance is at most `max(1, floor(len / 3))` of the name without its dashes.

A throwaway prototype of these rules gave these suggestions:

| Command             | Typed           | Suggestion           |
| ------------------- | --------------- | -------------------- |
| jira `comment`      | `--comment`     | `--body`             |
| jira `comment`      | `--message`     | `--body`             |
| jira `comment`      | `--visiblity`   | `--visibility`       |
| jira `create`       | `--descripton`  | `--description`      |
| jira `create`       | `--body-file`   | `--description-file` |
| jira `create`       | `--label`       | `--labels`           |
| jira `transition`   | `--body-file`   | `--comment-file`     |
| confluence `create` | `--body-flie`   | `--body-file`        |
| confluence `create` | `--description` | `--body`             |
| bb `pr comment add` | `--add`         | `--body`             |
| bb `pr comment add` | `--reply`       | `--reply-to`         |
| bb `pr create`      | `--body`        | `--description`      |
| bb `pr create`      | `--reviewer`    | `--reviewers`        |

It gave no suggestion for jira `comment --limit`, jira `transition --status` or bb `pr create --target`.

An **extra positional** names the first unexpected argument and explains quoting:

```
Error: Unexpected argument "merge" for 'af jira comment'.
Text with spaces or apostrophes must be quoted, or sent with --body-file (a path, or - with a quoted heredoc).
```

When the unexpected argument is exactly `-`, the second line becomes `To read stdin, use --body-file -.` A rule without a prose pair (Jira `comment delete`, `worklog list` and `worklog delete`; Bitbucket `pr comment` and `pr task` actions that take no body) prints the first line only.

The command names in messages use `af bitbucket`, because the handler cannot tell which alias was typed.

### D12. Help: one full reference per product

**`commands/help.ts` delegates to the product renderers.**

- `showJiraHelp` and `showConfluenceHelp` become exported, and Bitbucket's `showHelp` becomes the exported `showBitbucketHelp`.
- `showCommandHelp` calls them for `jira`, `confluence`, `bitbucket` and `bb`.
- The abbreviated `HELP_CONTENT` entries for those four keys are deleted, so the two sources cannot drift again.
- `router.ts` is unchanged. As a result `af jira --help`, `af help jira`, `af jira`, `af jira help` and `af jira <sub> --help` all print the same text, which also satisfies cli-help-system's "output matches `af help <cmd>`". The same holds for Confluence, Bitbucket and `bb`.

**Content changes:**

- **Jira** (`showJiraHelp`):
    - The COMMANDS row for `comment` says it lists, or adds with `--body` / `--body-file`.
    - COMMENT OPTIONS document `--body`, `--body-file <path|->`, `--add` (alias of `--body`), `--visibility`, and `--internal` / `--public`. The last two say the text is sent as typed and JSM renders it as wiki markup, not markdown.
    - The create, update, transition and worklog prose flags are documented with their `-file` twins as "markdown, converted to ADF".
    - Version `--description` / `--description-file` are documented as "plain text, sent as typed".
    - `--limit` moves from OPTIONS to LIST / SEARCH OPTIONS.
- **Confluence** (`showConfluenceHelp`):
    - `comment` documents `--body` / `--body-file` / `--add`, and the inaccurate "(omit to list comments)" (`commands/confluence.ts:131`) is fixed: listing is `comments`.
    - `--body-file` documents `-` on `create` and `update`.
    - `--limit` moves out of the global OPTIONS into a section for the commands that read it (`list`, `search`, `tree`, `comments`, `labels`, `attachments`, `spaces`), as on Jira. The strict rules reject it on `create`, `update` and `comment`, so the help must not present it as global.
- **Bitbucket** (`showBitbucketHelp`):
    - `--body-file` and `--description-file` document `-`.
    - A note says the text is sent as typed and rendered as markdown.

**Each product's help gains a MULTI-LINE TEXT section.** Its example block is printed flush-left: copying an indented terminator never ends a heredoc, and indented markdown loses its headings. The Jira section looks like this; Confluence uses `af confluence comment 12345` and Bitbucket uses `af bb pr comment add 42` in the example:

```
MULTI-LINE TEXT:
  Inside "double" or 'single' quotes, \n stays a backslash and an n; it is never
  a newline. Double quotes also run `commands` and expand $VARS. For multi-line
  text, use a -file flag: pass a path, or - and a quoted heredoc (keep AF_BODY
  at the start of its line):

af jira comment PROJ-123 --body-file - <<'AF_BODY'
## Summary

- First point
AF_BODY
```

The docstring at `jira/lib/client.ts:300-304` is corrected to say "wiki markup". This is a comment-only change, so code and help agree.

Rejected alternatives:

- **Routing `af <cmd> --help` to the product handlers in `router.ts`.** `af help jira` would still need `help.ts` changed, so the router change buys nothing.
- **Keeping the abbreviated entries with a "see `af jira help`" pointer.** It preserves two sources, and agents read the first one only.

### D13. Documentation

- **`README.md`**
    - Add a "Multi-line text" subsection under Jira covering:
        - the heredoc example;
        - why `"…\n…"` in double quotes never produces newlines, and that double quotes also run backticks and expand `$`;
        - the file-path alternative, for harnesses that reject multi-line commands;
        - avoiding `echo "…\n…" |`, whose behaviour depends on the shell, and `printf "$text"`, which treats `%` as a format directive;
        - that `"$(cat <<'EOF' …)"` breaks in macOS `/bin/bash` 3.2 when the text contains an apostrophe or an unmatched `)`.
    - Switch the comment examples to `--body`.
    - Show `--body-file -` for Confluence and Bitbucket.
    - Note that prose commands reject unknown options, and that options accept `--flag=value` (D9).
- **`CLAUDE.md`**
    - Mirror that guidance in the Jira "Comments" bullet, the Confluence block and the Bitbucket block.
    - Add `utils/text-input.ts` and `utils/cli-args.ts` to the Project Structure tree.
    - Extend "Adding New Commands": prose flags get a `-file` twin through `readProse`, and prose commands declare a strict rule.

### D14. Tests

- `utils/text-input.test.ts` (new)
    - **Covers:** Every `cli-text-input` scenario, plus a test that `readStdin` is never called without `-`, and that exclusion fails before any read.
    - **Technique:** Fake `TextInputIo` whose readers throw if called unexpectedly.
- `utils/cli-args.test.ts` (new)
    - **Covers:** `splitOptionToken`; unknown-option and extra-argument messages; the suggestion table in D11.
    - **Technique:** Pure functions.
- `commands/jira.test.ts` (new)
    - **Covers:** jira-command scenarios: flag-to-client mapping, empty-value table, strictness, `=value`, D8 ordering.
    - **Technique:** `vi.mock('../jira/lib/client.ts', async importOriginal => ({ ...(await importOriginal()), addComment: vi.fn(), … }))`. A partial mock is required because `jira/lib/formatters.ts` imports `adfToText` from the client. Stdin uses `vi.spyOn(defaultTextInputIo, 'readStdin')` and `stdinIsTTY`. Files are written at runtime to `mkdtempSync(join(tmpdir(), 'af-text-input-'))` and removed in `afterEach`.
- `commands/confluence.test.ts` (new)
    - **Covers:** confluence-command scenarios.
    - **Technique:** Same technique, with `confluence/lib/client.ts` partially mocked.
- `commands/bitbucket.test.ts` (extend)
    - **Covers:** bitbucket-command scenarios: `parseArgs` strictness and `=value` directly, plus `--body-file -`, `File not found` and empty-body handling.
    - **Technique:** Add `addComment`, `updateComment`, `addTask`, `updateTask`, `createPullRequest`, `updatePullRequest`, `getCurrentBranch` and `getRepository` to the explicit client mock list. Existing tests already pass the strict rules.
- `commands/help.test.ts` (new)
    - **Covers:** `handleHelp('jira')` output equals `handleJira(['--help'])`, and likewise for Confluence, Bitbucket and `bb`. Required strings are present, and the five example lines appear consecutively at column 0.
    - **Technique:** `console.log` spy.
- `integration.test.ts` (extend)
    - **Covers:** The real stdin path: `bun --no-env-file <abs>/main.ts jira comment PROJ-1 --body-file -`. The spawned process gets a temp cwd and an env containing only `PATH`, `HOME` and fake `ATLASSIAN_*` values that point at a local `http.createServer` on `127.0.0.1`, with markdown written to its stdin. The server receives one POST whose ADF has a level-2 heading and a bullet list. With stdin from `/dev/null`, the process exits 1 and no request arrives.
    - **Technique:** Spawned Bun process plus a local HTTP server. Node's `stdio: 'pipe'` gives the child a UNIX socket, not a FIFO (measured). Bun's `readFileSync(0)` reads it to end-of-file, even across delayed writes, but only once the parent calls `end()`. A test that forgets `end()` hangs, exactly like an agent shell's socket.
- `jira/lib/client.test.ts` (extend)
    - **Covers:** The request bodies behind the "unchanged" rows of D5, which handler tests with a mocked client cannot see: `updateIssue` with `description: ''` sends `fields.description: null`; `transitionIssue` with `comment: ''` sends no `update`; `updateWorklog` with `comment: ''` sends an empty ADF document; `updateVersion` with `description: ''` sends `description: ''`.
    - **Technique:** The file's existing fetch mock.

Fixtures with CRLF, a BOM or only whitespace are generated in the test, never committed, because Prettier would rewrite them and CSpell would scan them. The shell-level heredoc check in zsh and bash is a manual smoke test (tasks), because CI has no zsh.

## Risks / Trade-offs

- **[BREAKING: scripts that pass options af used to ignore now fail]** → Only the prose commands are strict. The error names the option, suggests the fix and lists the accepted options. The release notes list every breaking item.
- **[BREAKING: Confluence `--body` with `--body-file` fails, and an empty `--body-file` no longer creates an empty page]** → Both errors say what to do. An empty page is still created by omitting the body.
- **[BREAKING: `-` on a `-file` flag now means stdin]** → A file named `-` is read as `./-`.
- **[An agent shell hangs on stdin]** In the Claude Code Bash tool, fd 0 is a socket when the command line contains a heredoc. → af reads stdin only for `-`. The docs attach the heredoc to the af command itself. A missing heredoc gives `/dev/null`, which is rejected as empty.
- **[Interactive users do not know how to finish input]** → The D7 hint names Ctrl-D.
- **[Heredoc pitfalls]** These are an unquoted delimiter (expands `$` and backticks), an indented delimiter (never terminates), a delimiter that collides with the body, and `<<-` (strips tabs). → Help and docs prescribe `<<'AF_BODY'`, flush-left, distinctive. The example is printed flush-left and tested.
- **[`EAGAIN` from `readFileSync(0)`]** This was measured under Node, not Bun. af runs on Bun. → `isatty(0)` instead of `process.stdin`, and a clear error if it ever happens.
- **[A wrong suggestion]** → Suggestions appear only for unique, close matches, and the accepted options are always listed.
- **[`af help jira` changes from the styled abbreviated view to the full plain reference]** → This is intended. Existing integration tests only check general help and `af help sonar`.
- **[Binary or non-UTF-8 files]** → Decoded with replacement characters, as `--body-file` already does today in Bitbucket and Confluence. This is a non-goal.
- **[Type-check noise]** `npx tsc --noEmit` already reports 29 errors in 6 files at HEAD, 6 of them in `commands/bitbucket.test.ts`. → Verification requires no new errors, not a clean run. Count them with `--pretty false`: the installed TypeScript 7 colors its output even when piped, so a plain `grep -c 'error TS'` reports 0.

## Migration Plan

1. Implement after `fix-adf-converter-hang` (tasks 1.1). File and stdin input would otherwise feed CRLF and BOM text into a converter that hangs on it.
2. Ship in one release. Its notes list the breaking items and show the heredoc form. The breaking items:
    - unknown options and extra positionals fail on prose commands;
    - Confluence `--body` + `--body-file` fails;
    - `-` on `-file` flags means stdin;
    - empty file or stdin input fails, so an empty `--body-file` no longer creates an empty Confluence page or posts an empty Bitbucket comment;
    - an empty or whitespace-only inline body fails on every comment and task body (D5): Jira `comment <key>` (platform and JSM; `--add ""` used to list the comments), Jira `comment edit`, Confluence `comment` (`--add " "` used to post an empty comment), and Bitbucket comment and task bodies;
    - `--add` together with `--body` fails on Jira `comment edit`, where `--body` used to win.
3. No data or configuration migration. Rollback is a revert.

## Open Questions

- **Credential leak check.** Should af refuse a body that contains the value of a credential it holds (`ATLASSIAN_API_TOKEN`, `BITBUCKET_API_TOKEN`, `SONAR_TOKEN`)? This is from the proposal. It is an exact-match check with essentially no false positives, and it would catch a token leaked by backtick or `$` expansion.
- **Short alias.** Should `-file` flags gain a short alias (`-F`), or should `--stdin` be offered as a discoverable synonym for `--<flag>-file -`? This is also from the proposal.
- **Literal `-` on an inline flag.** Should an inline prose value of exactly `-` (for example `--body - <<'AF_BODY'`) be rejected with a pointer to `--body-file -`? Today it posts a lone `-` and ignores the heredoc. This design keeps argv verbatim and leaves the check out. The recommendation is to add it: it is an exact match that no real comment needs, and it catches a likely agent slip. If it is adopted, it is a new `cli-text-input` scenario and one more breaking item.

<!-- cspell:words EISDIR EAGAIN ENOENT frobnicate visiblity descripton flie isatty glab -->
