// cspell:words visiblity descripton flie
import { describe, it, expect } from 'vitest';
import { checkStrictArgs, splitOptionToken, suggestOption, type StrictRule } from './cli-args.ts';

// Rules mirroring a few rows of the product tables.
const jiraComment: StrictRule = {
    command: 'af jira comment',
    options: ['--body', '--body-file', '--add', '--visibility', '--internal', '--public', '--json'],
    maxPositionals: 1,
    prose: { inline: '--body', file: '--body-file' },
};
const jiraCommentDelete: StrictRule = {
    command: 'af jira comment delete',
    options: ['--json'],
    maxPositionals: 3,
};
const jiraCreate: StrictRule = {
    command: 'af jira create',
    options: [
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
        '--json',
    ],
    maxPositionals: 0,
    prose: { inline: '--description', file: '--description-file' },
};
const jiraTransition: StrictRule = {
    command: 'af jira transition',
    options: ['--to', '--resolution', '--comment', '--comment-file', '--field', '--json'],
    maxPositionals: 1,
    prose: { inline: '--comment', file: '--comment-file' },
};
const confluenceCreate: StrictRule = {
    command: 'af confluence create',
    options: ['--space', '--title', '--body', '--body-file', '--parent', '--status', '--json'],
    maxPositionals: 0,
    prose: { inline: '--body', file: '--body-file' },
};
const bbCommentAdd: StrictRule = {
    command: 'af bitbucket pr comment add',
    options: [
        '--body',
        '--body-file',
        '--file',
        '--line',
        '--reply-to',
        '--json',
        '--workspace',
        '--repo',
    ],
    maxPositionals: 3,
    prose: { inline: '--body', file: '--body-file' },
};
const bbCreate: StrictRule = {
    command: 'af bitbucket pr create',
    options: [
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
        '--json',
        '--workspace',
        '--repo',
    ],
    maxPositionals: 1,
    prose: { inline: '--description', file: '--description-file' },
};

function thrownMessage(fn: () => void): string {
    try {
        fn();
    } catch (err) {
        return (err as Error).message;
    }
    throw new Error('expected an error');
}

describe('splitOptionToken', () => {
    it('splits --name=value at the first =', () => {
        expect(splitOptionToken('--a=b')).toEqual({ flag: '--a', inlineValue: 'b' });
        expect(splitOptionToken('--a=b=c')).toEqual({ flag: '--a', inlineValue: 'b=c' });
    });

    it('keeps an empty value after =', () => {
        expect(splitOptionToken('--a=')).toEqual({ flag: '--a', inlineValue: '' });
    });

    it('returns the bare flag when there is no =', () => {
        expect(splitOptionToken('--a')).toEqual({ flag: '--a' });
    });

    it('returns undefined for a token that is not an option', () => {
        expect(splitOptionToken('PROJ-1')).toBeUndefined();
        expect(splitOptionToken('-')).toBeUndefined();
        expect(splitOptionToken('-h')).toBeUndefined();
    });
});

describe('suggestOption', () => {
    it.each([
        [jiraComment, '--comment', '--body'],
        [jiraComment, '--message', '--body'],
        [jiraComment, '--visiblity', '--visibility'],
        [jiraCreate, '--descripton', '--description'],
        [jiraCreate, '--body-file', '--description-file'],
        [jiraCreate, '--label', '--labels'],
        [jiraTransition, '--body-file', '--comment-file'],
        [confluenceCreate, '--body-flie', '--body-file'],
        [confluenceCreate, '--description', '--body'],
        [bbCommentAdd, '--add', '--body'],
        [bbCommentAdd, '--reply', '--reply-to'],
        [bbCreate, '--body', '--description'],
        [bbCreate, '--reviewer', '--reviewers'],
    ])('on %s suggests for %s: %s', (rule, typed, expected) => {
        expect(suggestOption(typed, rule)).toBe(expected);
    });

    it.each([
        [jiraComment, '--limit'],
        [jiraTransition, '--status'],
        [bbCreate, '--target'],
    ])('on %s suggests nothing for %s', (rule, typed) => {
        expect(suggestOption(typed, rule)).toBeUndefined();
    });

    it('skips the prose mapping on a rule without a prose pair', () => {
        expect(suggestOption('--body', jiraCommentDelete)).toBeUndefined();
    });

    it('suggests nothing for a bare --', () => {
        expect(suggestOption('--', jiraCommentDelete)).toBeUndefined();
        expect(suggestOption('--', jiraComment)).toBeUndefined();
    });
});

describe('checkStrictArgs', () => {
    it('accepts known options and positionals up to the limit', () => {
        expect(() => checkStrictArgs(jiraComment, ['--body', '--json'], ['PROJ-1'])).not.toThrow();
        expect(() =>
            checkStrictArgs(jiraCommentDelete, [], ['delete', 'PROJ-1', '10042']),
        ).not.toThrow();
    });

    it('names an unknown option and the command, suggests a fix and lists the accepted options', () => {
        expect(thrownMessage(() => checkStrictArgs(jiraComment, ['--comment'], ['PROJ-1']))).toBe(
            [
                "Unknown option --comment for 'af jira comment'. Did you mean --body?",
                'Accepted options: --body, --body-file, --add, --visibility, --internal, --public, --json',
                "Run 'af jira --help' for usage.",
            ].join('\n'),
        );
    });

    it('omits the suggestion when the intent is unclear', () => {
        expect(thrownMessage(() => checkStrictArgs(jiraComment, ['--limit'], ['PROJ-1']))).toBe(
            [
                "Unknown option --limit for 'af jira comment'.",
                'Accepted options: --body, --body-file, --add, --visibility, --internal, --public, --json',
                "Run 'af jira --help' for usage.",
            ].join('\n'),
        );
    });

    it('points to the product help of the command', () => {
        expect(thrownMessage(() => checkStrictArgs(bbCreate, ['--target'], []))).toContain(
            "Run 'af bitbucket --help' for usage.",
        );
    });

    it('names the first extra argument and explains quoting and the file flag', () => {
        expect(
            thrownMessage(() =>
                checkStrictArgs(jiraComment, ['--add'], ['PROJ-1', 'merge', 'until', 'QAs done']),
            ),
        ).toBe(
            [
                'Unexpected argument "merge" for \'af jira comment\'.',
                'Text with spaces or apostrophes must be quoted, or sent with --body-file (a path, or - with a quoted heredoc).',
            ].join('\n'),
        );
    });

    it('suggests the file flag when the extra argument is -', () => {
        expect(thrownMessage(() => checkStrictArgs(jiraTransition, [], ['PROJ-1', '-']))).toBe(
            [
                'Unexpected argument "-" for \'af jira transition\'.',
                'To read stdin, use --comment-file -.',
            ].join('\n'),
        );
    });

    it('prints only the first line for a rule without a prose pair', () => {
        expect(
            thrownMessage(() =>
                checkStrictArgs(jiraCommentDelete, [], ['delete', 'PROJ-1', '10042', 'extra']),
            ),
        ).toBe('Unexpected argument "extra" for \'af jira comment delete\'.');
    });

    it('reports an unknown option before an extra argument', () => {
        expect(
            thrownMessage(() => checkStrictArgs(jiraComment, ['--nope'], ['PROJ-1', 'extra'])),
        ).toMatch(/^Unknown option --nope/);
    });
});
