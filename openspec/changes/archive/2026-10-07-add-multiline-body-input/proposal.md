# Accept multi-line bodies from a file or stdin, and reject unknown flags on prose commands

## Why

AI agents keep posting broken Jira comments. A typical call is `af jira comment KEY --add "## Summary\n\n- one"`. It arrives as one giant heading with every `\n` visible. Inside a double-quoted shell argument, neither bash nor zsh turns `\n` into a newline, and `textToAdf` splits only on real newlines.

The Jira side has no other way to receive multi-line text. These prose flags accept only an inline argument, never a file or stdin:

- comment add and edit;
- issue description on create and update;
- transition comment;
- worklog comment;
- version description.

Confluence comments have the same limitation. Bitbucket and Confluence pages accept `--body-file`, but only a path, never `-`.

Double quotes cause silent damage as well. All of these were verified in zsh, macOS bash 3.2 and bash 5.2:

- Backticks around markdown inline code are command substitution. `` `textToAdf` `` vanishes from the comment with only a "command not found" on stderr, while af reports success.
- `` `rm -rf node_modules` `` actually runs.
- `` `env` `` writes the calling shell's environment into the comment body. That includes `ATLASSIAN_API_TOKEN` when it is exported there; a token kept only in the project `.env` is loaded inside af and does not leak this way.
- `$VAR` and `$100` expand.

af cannot detect any of this after the fact. Only one form delivered arbitrary text byte-for-byte in all three shells: a quoted heredoc on stdin. The popular `"$(cat <<'EOF' …)"` wrapper breaks on macOS `/bin/bash` 3.2 when the text contains an apostrophe or an unmatched `)`.

Other CLIs that hit this fixed it the same way:

- linear-cli had the identical report (`--description "## Summary\n\n- one\n- two"`, schpet/linear-cli#133). It shipped `--body-file` / `--description-file` (PR #138) and now also accepts `-` for stdin.
- gh, git and glab use the same file-flag-plus-`-` convention.
- None of them unescape `\n`.

Two adjacent traps make the failure hard to notice:

- **Wrong flag names fail silently or misleadingly.**
    - `af jira comment KEY --body "…"` (Bitbucket's flag name), `--comment "…"` and `--body-file note.md` all list the comments, exit `0` and post nothing.
        - The Jira parser accepts any unknown `--flag value` (`commands/jira.ts:148-158`).
        - The handler then falls through to listing (`commands/jira.ts:644,665-667`).
    - `--add="…"` posts nothing either.
        - As the last argument it fails with the misleading `Option --add=… requires a value`.
        - Before another flag it swallows that flag as its value and lists.
    - Extra positional words are silently dropped. The shell splits `--add 'Don't merge until QA's done'` into four arguments; af posts only the first and drops the rest.
- **The help agents are told to read omits the command.**
    - The user-level agent workflows say to run `af jira --help`.
    - `router.ts:46-48` routes that to the abbreviated help in `commands/help.ts`, which never mentions `comment`.
    - The only comment-like flag it shows is `--comment` on `transition` and `worklog`, which is exactly one of the silent no-op guesses above.

## What Changes

- **A shared text-input helper** in `utils/` resolves a prose value from an inline flag, a `-file` twin holding a path, or `-` for stdin.
    - Stdin is read only when `-` is given explicitly; it is never auto-detected. Agent shells give commands `/dev/null` or a socket as stdin, so an implicit read either hangs or returns nothing.
    - Supplying both the inline flag and its `-file` twin is an error that names both flags, matching Bitbucket's current behaviour.
    - An empty body after reading is an error rather than an empty post. Inline values that a command requires are treated the same way.
    - A missing file reports `File not found: <path>` on every command, instead of a raw `ENOENT`.
    - Content is never otherwise altered, except that one leading byte-order mark is dropped from file and stdin input. In particular, escape sequences such as `\n` are **not** interpreted.
- **Jira**
    - `comment <KEY>` (add) gains `--body` / `--body-file`. `--add` stays as an alias of `--body`, so Bitbucket's flag names now work instead of silently listing.
    - `comment edit` already takes `--body` and also accepts `--add`. It gains `--body-file`, and `--add` remains accepted.
    - `create` / `update` gain `--description-file`.
    - `transition` and `worklog add|update` gain `--comment-file`.
    - `version-create` / `version-update` gain `--description-file`. Version descriptions are sent as plain text, not ADF.
    - The JSM `--internal` / `--public` comment path accepts the same inputs.
- **Confluence**
    - `comment` takes `--body` / `--body-file`, keeping `--add` as an alias. This extends the Jira `comment` decision to Confluence; neither product gets an `--add-file`.
    - `create` / `update --body-file` accept `-`.
    - Passing `--body` together with `--body-file` becomes an error; today `--body` silently wins.
- **Bitbucket**: the existing `--body-file` / `--description-file` accept `-`.
- **Stricter argument parsing** on commands that take prose. The prose-taking commands are:
    - Jira `comment` (every action: list, add, edit and delete), `create`, `update`, `transition`, `worklog`, `version-create` and `version-update`;
    - Confluence `create`, `update` and `comment`;
    - Bitbucket `pr create`, `pr update`, `pr comment …` and `pr task …`.

    On these commands:
    - Unknown options and unexpected extra positional arguments become errors (exit `1`) instead of being ignored. Sonar already rejects unknown options (`commands/sonar.ts:83-84`).
    - `--flag=value` is supported, split at the first `=`, here and on every other Jira, Confluence and Bitbucket subcommand. A boolean flag written with `=` is rejected with a clear message.
    - **BREAKING** for scripts that pass flags af currently ignores.

- **Help and docs steer agents to the safe form.**
    - Every prose flag's help names its `-file` twin.
    - It also says what the text becomes:
        - markdown converted to ADF on Jira and Confluence;
        - sent as typed for Jira `comment --internal` / `--public`, which Jira Service Management renders as wiki markup;
        - plain text for Jira version descriptions.
    - Each command's help shows a multi-line example: a quoted heredoc on stdin with a distinctive delimiter written flush-left. An indented delimiter never terminates the heredoc, and a common one like `EOF` can collide with the body text.

        ```
        af jira comment PROJ-123 --body-file - <<'AF_BODY'
        ## Summary

        - First point
        AF_BODY
        ```

    - `af jira --help` and `af help jira` document the `comment` subcommand and its body flags; today they omit both. The Confluence and Bitbucket help gain the same multi-line example.
    - `README.md` and `CLAUDE.md` gain the same guidance, including why `"…\n…"` in double quotes never produces newlines.

Explicitly **not** part of this change (decided during exploration):

- **No detection of literal `\n` and no automatic unescaping.**
    - af sends argv text exactly as typed.
    - The fix is a reliable input channel plus guidance, as in linear-cli.
    - Heuristic detectors were evaluated. The strong signals had no false positives in testing, but this change deliberately ships without any guard.
- No change to the converter's markdown coverage; that is `replace-markdown-adf-converter`.
- **No change to how JSM `--internal` / `--public` bodies render.**
    - The Service Desk API interprets them as Jira wiki markup, so markdown headings, bold, code and links render wrong there even with real newlines.
    - The `sd.public.comment` workaround remains ruled out (`openspec/changes/archive/2026-06-16-expand-jira-api-coverage/design.md:87`).
    - This is left as a follow-up.
- No `-file` twins for single-line text flags: `--summary`, `--title`, `--name`, and Confluence `--message`.
- No `--field name=@file` form for multi-line (textarea) custom fields.

## Capabilities

### New Capabilities

- `cli-text-input`: resolving prose input from an inline flag, a file, or stdin (`-`). It covers:
    - mutual exclusion of inline and file input;
    - stdin read only on an explicit `-`;
    - rejection of empty content;
    - consistent missing-file errors;
    - content passed through verbatim (apart from a leading byte-order mark on file and stdin input), with no escape interpretation.

### Modified Capabilities

- `jira-command`:
    - comment add gains `--body` / `--body-file`, with `--add` as an alias;
    - `comment edit` gains `--body-file`, and `--body` and `--add` stay accepted;
    - `create` / `update` and `version-create` / `version-update` gain `--description-file`;
    - `transition` and `worklog` gain `--comment-file`;
    - unknown options and extra positionals on these commands are rejected;
    - options accept `--name=value`;
    - the Help documentation requirement covers the `comment` subcommand, its body flags, a multi-line example, and the JSM wiki-markup exception.
- `confluence-command`:
    - `comment` takes `--body` / `--body-file`, with `--add` as an alias;
    - `--body-file` accepts `-`;
    - inline plus file input is an error;
    - unknown options and extra positionals on `create`, `update` and `comment` are rejected;
    - options accept `--name=value`;
    - the Help documentation requirement includes the multi-line example.
- `bitbucket-command`:
    - `--body-file` and `--description-file` accept `-`, and the existing mutual exclusion of inline and file input also covers `-`;
    - unknown options and extra positionals on `pr create`, `pr update`, `pr comment …` and `pr task …` are rejected (exit `1`);
    - options accept `--name=value`;
    - help includes the multi-line example, and `af bb --help` and `af help bb` print the full reference.

## Impact

- **Code:**
    - new `utils/text-input.ts`, and new `utils/cli-args.ts` for the `--flag=value` splitting and option checks the three parsers share, both with tests;
    - new `commands/jira.test.ts`, `commands/confluence.test.ts` and `commands/help.test.ts`, empty-value cases in `jira/lib/client.test.ts`, and a stdin case in `integration.test.ts`;
    - the `addServiceDeskComment` docstring in `jira/lib/client.ts`, which wrongly calls JSM bodies plain text (comment only);
    - `commands/jira.ts`: `parseArgs`; the comment, create, update, transition, worklog and version handlers; and `showJiraHelp`;
    - `commands/help.ts` (Jira, Confluence and Bitbucket entries);
    - `commands/confluence.ts`: replace `getBodyContent`, add comment flags, tighten the parser;
    - `commands/bitbucket.ts`: `readBody` and `readDescription` move to the helper, and the exported `parseArgs` rejects unknown options and extra positionals on the PR commands above, with `commands/bitbucket.test.ts` updated to match;
    - `README.md` and `CLAUDE.md`.
- **Depends on `fix-adf-converter-hang`.** File and stdin input bring CRLF and BOM-prefixed text to `textToAdf`, which currently hangs on CRLF headings.
- **BREAKING:**
    - On prose commands, unknown options and extra positionals now fail instead of being ignored.
    - Confluence `--body` combined with `--body-file` now fails.
    - A body value of exactly `-` on a `-file` flag now means stdin.
    - Empty file or stdin input now fails. An empty `--body-file` used to create an empty Confluence page or post an empty Bitbucket comment.
    - An empty or whitespace-only inline body now fails on every comment and task body:
        - Jira `comment <KEY>`, including `--internal` / `--public`, where `--add ""` used to list the comments and `--add " "` posted an empty comment;
        - Jira `comment edit`;
        - Confluence `comment`, where `--add " "` posted an empty comment;
        - Bitbucket comment and task bodies.
    - `--add` together with `--body` now fails on `comment edit`, where `--body` used to win.
- **Packaging:** no new runtime dependencies. `utils/` is already in the `package.json` `files` allowlist.

## Open Questions

- Should af refuse a body that contains the value of a credential it holds (`ATLASSIAN_API_TOKEN`, `BITBUCKET_API_TOKEN`, `SONAR_TOKEN`)? This is an exact-match check with essentially no false positives. It would catch a token leaked into a comment by backtick or `$` expansion in the calling shell.
- Should `-file` flags gain a short alias (`-F`, as in gh, git and acli), or should `--stdin` be offered as a discoverable synonym for `--body-file -` (as in beads)?

<!-- cspell:words schpet glab acli ENOENT -->
