// Helpers shared by the Jira, Confluence and Bitbucket argument parsers:
// `--name=value` splitting, and strict option checking for the commands that
// take prose (where a mistyped or ignored option used to fail silently).

/** An option token, split at its first `=`. */
export interface OptionToken {
    /** The option as typed, without `=value`, for example `--body`. */
    flag: string;
    /** The text after the first `=`, when the token had one. It may be empty. */
    inlineValue?: string;
}

/** Splits `--name=value` at the first `=`. Returns undefined for a token that is not an option. */
export function splitOptionToken(arg: string): OptionToken | undefined {
    if (!arg.startsWith('--')) return undefined;
    const eq = arg.indexOf('=');
    return eq === -1 ? { flag: arg } : { flag: arg.slice(0, eq), inlineValue: arg.slice(eq + 1) };
}

/** What a strict command accepts. */
export interface StrictRule {
    /** The command as shown in messages, for example `af jira comment edit`. */
    command: string;
    /** Accepted options as typed, globals and aliases included. */
    options: string[];
    /** The positional arguments allowed after the product's subcommand. */
    maxPositionals: number;
    /** The command's prose flag and its file twin, when it takes prose. */
    prose?: { inline: string; file: string };
}

// Prose flag names used by some af command; on a command whose own prose flag
// is different, they suggest that flag (or its file twin).
const PROSE_INLINE_NAMES = new Set([
    '--body',
    '--add',
    '--comment',
    '--description',
    '--desc',
    '--message',
    '--text',
    '--note',
]);
const PROSE_FILE_NAMES = new Set([
    '--body-file',
    '--comment-file',
    '--description-file',
    '--add-file',
    '--file',
    '--message-file',
    '--text-file',
]);

/**
 * Suggests the option the user probably meant, or undefined when the intent is
 * unclear. Tries, in order: another command's prose flag mapped to this rule's
 * prose flag or file twin; the only accepted option that starts with the name;
 * the uniquely closest accepted option within max(1, floor(length / 3)) edits.
 */
export function suggestOption(name: string, rule: StrictRule): string | undefined {
    // A bare `--` names nothing, so there is nothing to suggest.
    if (stripDashes(name) === '') return undefined;

    if (rule.prose) {
        if (PROSE_INLINE_NAMES.has(name)) return rule.prose.inline;
        if (PROSE_FILE_NAMES.has(name)) return rule.prose.file;
    }

    const prefixed = rule.options.filter(option => option.startsWith(name));
    if (prefixed.length === 1) return prefixed[0];

    const bare = stripDashes(name);
    const limit = Math.max(1, Math.floor(bare.length / 3));
    let best: string | undefined;
    let bestDistance = Infinity;
    let tied = false;
    for (const option of rule.options) {
        const distance = editDistance(bare, stripDashes(option));
        if (distance < bestDistance) {
            best = option;
            bestDistance = distance;
            tied = false;
        } else if (distance === bestDistance) {
            tied = true;
        }
    }
    return !tied && bestDistance <= limit ? best : undefined;
}

/**
 * Throws when the command line uses an option the rule does not accept, or more
 * positional arguments than it takes. `typedOptions` are the option names as
 * typed (before alias normalization, without `=value`); `positionals` are the
 * arguments after the product's subcommand.
 */
export function checkStrictArgs(
    rule: StrictRule,
    typedOptions: string[],
    positionals: string[],
): void {
    const unknown = typedOptions.find(option => !rule.options.includes(option));
    if (unknown !== undefined) {
        const suggestion = suggestOption(unknown, rule);
        const product = rule.command.split(' ').slice(0, 2).join(' ');
        throw new Error(
            [
                `Unknown option ${unknown} for '${rule.command}'.` +
                    (suggestion ? ` Did you mean ${suggestion}?` : ''),
                `Accepted options: ${rule.options.join(', ')}`,
                `Run '${product} --help' for usage.`,
            ].join('\n'),
        );
    }

    if (positionals.length > rule.maxPositionals) {
        const extra = positionals[rule.maxPositionals];
        const lines = [`Unexpected argument "${extra}" for '${rule.command}'.`];
        if (rule.prose) {
            lines.push(
                extra === '-'
                    ? `To read stdin, use ${rule.prose.file} -.`
                    : `Text with spaces or apostrophes must be quoted, or sent with ${rule.prose.file} (a path, or - with a quoted heredoc).`,
            );
        }
        throw new Error(lines.join('\n'));
    }
}

function stripDashes(option: string): string {
    return option.replace(/^-+/, '');
}

// Levenshtein distance with a single row.
function editDistance(a: string, b: string): number {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        let diagonal = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const above = row[j];
            row[j] = Math.min(
                above + 1,
                row[j - 1] + 1,
                diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
            diagonal = above;
        }
    }
    return row[b.length];
}
