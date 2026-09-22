import { describe, it, expect } from 'vitest';
import {
    formatAccount,
    formatBranchList,
    formatCommentList,
    formatCommitList,
    formatDiffStat,
    formatMembers,
    formatMyPullRequestList,
    formatPipelineList,
    formatPullRequestList,
    formatReviewers,
    formatSrcList,
    formatStatusList,
    formatStepList,
    formatTaskList,
} from './formatters.ts';
import type {
    BitbucketComment,
    BitbucketCommit,
    BitbucketCommitStatus,
    BitbucketDiffStatEntry,
    BitbucketParticipant,
    BitbucketPipeline,
    BitbucketPipelineStep,
    BitbucketPullRequest,
    BitbucketSrcEntry,
    BitbucketTask,
    BitbucketWorkspaceMember,
    PullRequestSignals,
} from './types.ts';

const fakeUser = {
    type: 'user' as const,
    account_id: 'acct1',
    nickname: 'alice',
    display_name: 'Alice',
};

describe('formatPullRequestList', () => {
    it('renders empty', () => {
        expect(formatPullRequestList([])).toBe('_No pull requests._');
    });

    it('renders a row per PR', () => {
        const pr: BitbucketPullRequest = {
            id: 42,
            title: 'Fix bug',
            state: 'OPEN',
            author: fakeUser,
            source: { branch: { name: 'feature/x' } },
            destination: { branch: { name: 'main' } },
            created_on: '2025-01-01T00:00:00Z',
            updated_on: '2025-01-02T00:00:00Z',
        };
        const out = formatPullRequestList([pr]);
        expect(out).toContain('Fix bug');
        expect(out).toContain('feature/x → main');
        expect(out).toContain('OPEN');
    });
});

describe('formatMyPullRequestList', () => {
    const base: BitbucketPullRequest = {
        id: 42,
        title: 'Fix bug',
        state: 'OPEN',
        author: fakeUser,
        source: { branch: { name: 'feature/x' } },
        destination: { branch: { name: 'main' }, repository: { full_name: 'acme/api' } },
        created_on: '2025-01-01T00:00:00Z',
        updated_on: '2025-01-02T00:00:00Z',
    };

    it('renders empty', () => {
        expect(formatMyPullRequestList([])).toBe('_No pull requests._');
    });

    it('renders a Repo column instead of Author', () => {
        const out = formatMyPullRequestList([base]);
        const [header, , row] = out.split('\n');
        expect(header).toBe('| Repo | ID | State | Title | Branches | Review | Tasks | Updated |');
        expect(header).not.toContain('Author');
        expect(row).toMatch(/^\| acme\/api \| #42 \| OPEN \| Fix bug \| feature\/x → main \| /);
    });

    it('falls back to — when the destination repository is missing', () => {
        const out = formatMyPullRequestList([
            { ...base, destination: { branch: { name: 'main' } } },
        ]);
        expect(out.split('\n')[2]).toMatch(/^\| — \| #42 \|/);
    });

    it('escapes pipes in titles', () => {
        const out = formatMyPullRequestList([{ ...base, title: 'a | b' }]);
        expect(out).toContain('a \\| b');
    });
});

describe('pull request list review and signal columns', () => {
    const me = { ...fakeUser, account_id: 'me', display_name: 'Me' };
    const HEAD = 'abc123def456';
    const HEAD_FULL = `${HEAD}7890abc123def4567890abc123de`;

    const base: BitbucketPullRequest = {
        id: 42,
        title: 'Fix bug',
        state: 'OPEN',
        author: me,
        source: { branch: { name: 'feature/x' }, commit: { hash: HEAD } },
        destination: { branch: { name: 'main' }, repository: { full_name: 'acme/api' } },
        participants: [],
        reviewers: [],
        created_on: '2025-01-01T00:00:00Z',
        updated_on: '2025-01-02T00:00:00Z',
    };

    const person = (id: string) => ({ ...fakeUser, account_id: id, display_name: id });
    const vote = (
        id: string,
        state: 'approved' | 'changes_requested' | null,
        role: BitbucketParticipant['role'] = 'REVIEWER',
    ): BitbucketParticipant => ({ user: person(id), role, approved: state === 'approved', state });

    const status = (
        state: BitbucketCommitStatus['state'],
        hash: string = HEAD_FULL,
    ): BitbucketCommitStatus => ({ key: state, state, commit: { hash } });

    function signals(
        builds: PullRequestSignals['builds'] = { value: [] },
        conflicts: PullRequestSignals['conflicts'] = { value: { values: [] } },
    ): PullRequestSignals {
        return { builds, conflicts };
    }

    /** The cells of row `index`, keyed by column header. Titles must not contain pipes. */
    function row(out: string, index = 0): Record<string, string> {
        const lines = out.split('\n');
        const split = (line: string) => line.slice(2, -2).split(' | ');
        const header = split(lines[0] as string);
        const cells = split(lines[2 + index] as string);
        expect(cells).toHaveLength(header.length);
        return Object.fromEntries(header.map((h, i) => [h, cells[i] as string]));
    }

    describe('headers', () => {
        it('inserts Review and Tasks before Updated', () => {
            const [header, separator] = formatPullRequestList([base]).split('\n');
            expect(header).toBe(
                '| ID | State | Title | Author | Branches | Review | Tasks | Updated |',
            );
            expect(separator).toBe(
                '|----|-------|-------|--------|----------|--------|-------|---------|',
            );
            expect(formatMyPullRequestList([base]).split('\n')[1]).toBe(
                '|------|----|-------|-------|----------|--------|-------|---------|',
            );
        });

        it('adds Builds and Conflicts after Tasks when signals are supplied', () => {
            expect(formatPullRequestList([base], [signals()]).split('\n')[0]).toBe(
                '| ID | State | Title | Author | Branches | Review | Tasks | Builds | Conflicts | Updated |',
            );
            const [header, separator] = formatMyPullRequestList([base], [signals()]).split('\n');
            expect(header).toBe(
                '| Repo | ID | State | Title | Branches | Review | Tasks | Builds | Conflicts | Updated |',
            );
            expect(separator).toBe(
                '|------|----|-------|-------|----------|--------|-------|--------|-----------|---------|',
            );
        });

        it('keeps the existing leading cells in place', () => {
            const cells = row(formatPullRequestList([base], [signals()]));
            expect(cells).toMatchObject({
                ID: '#42',
                State: 'OPEN',
                Title: 'Fix bug',
                Author: 'Me',
                Branches: 'feature/x → main',
            });
            expect(row(formatMyPullRequestList([base])).Repo).toBe('acme/api');
        });
    });

    describe('Review cell', () => {
        const review = (pr: Partial<BitbucketPullRequest>) =>
            row(formatMyPullRequestList([{ ...base, ...pr }])).Review;

        it('excludes the author from approvals', () => {
            const participants = [
                vote('a', 'approved'),
                vote('b', 'approved'),
                { ...vote('x', 'approved', 'PARTICIPANT'), user: me },
            ];
            expect(review({ participants })).toBe('✓2');
        });

        it('shows changes requested after approvals', () => {
            expect(
                review({
                    reviewers: [person('a'), person('b')],
                    participants: [vote('a', 'approved'), vote('b', 'changes_requested')],
                }),
            ).toBe('✓1 ✗1');
        });

        it('shows reviewers who have not responded as pending', () => {
            expect(
                review({
                    reviewers: [person('a'), person('b'), person('c')],
                    participants: [vote('a', 'approved')],
                }),
            ).toBe('✓1 ○2');
        });

        it('joins all three parts in the order ✓ ✗ ○', () => {
            expect(
                review({
                    reviewers: [person('a'), person('b'), person('c')],
                    participants: [vote('a', 'approved'), vote('b', 'changes_requested')],
                }),
            ).toBe('✓1 ✗1 ○1');
        });

        it('does not count a participant who only commented', () => {
            expect(review({ participants: [vote('c', null, 'PARTICIPANT')] })).toBe('—');
        });

        it('shows — for no review activity and ? when participants are absent', () => {
            expect(review({})).toBe('—');
            expect(review({ participants: undefined })).toBe('?');
        });
    });

    describe('Tasks cell', () => {
        it('shows the open-task count, or — for 0 or an absent field', () => {
            const out = formatPullRequestList([
                { ...base, id: 1, task_count: 2 },
                { ...base, id: 2, task_count: 0 },
                { ...base, id: 3 },
            ]);
            expect([0, 1, 2].map(i => row(out, i).Tasks)).toEqual(['2', '—', '—']);
        });
    });

    describe('Builds cell', () => {
        const builds = (result: PullRequestSignals['builds']) =>
            row(formatMyPullRequestList([base], [signals(result)])).Builds;

        it('reflects only the head commit', () => {
            expect(
                builds({ value: [status('FAILED', 'fedcba987654'), status('SUCCESSFUL')] }),
            ).toBe('✓ 1 passed');
        });

        it('renders each state with its symbol', () => {
            expect(builds({ value: [status('FAILED'), status('SUCCESSFUL')] })).toBe('✗ 1 failed');
            expect(builds({ value: [status('STOPPED'), status('SUCCESSFUL')] })).toBe(
                '○ 1 stopped',
            );
            expect(builds({ value: [status('INPROGRESS'), status('SUCCESSFUL')] })).toBe(
                '⟳ 1 running',
            );
            expect(builds({ value: [] })).toBe('—');
        });

        it('shows ? when the statuses could not be fetched', () => {
            expect(builds({ error: { status: 403, message: 'Forbidden' } })).toBe('?');
        });
    });

    describe('Conflicts cell', () => {
        const conflicts = (result: PullRequestSignals['conflicts']) =>
            row(formatMyPullRequestList([base], [signals(undefined, result)])).Conflicts;
        const entry = (path: string) => ({ path });

        it('counts conflicts, or shows ✓ none', () => {
            expect(conflicts({ value: { values: [entry('a'), entry('b')] } })).toBe('✗ 2');
            expect(conflicts({ value: { values: [] } })).toBe('✓ none');
        });

        it('prefers size and marks a lower bound with +', () => {
            expect(conflicts({ value: { values: [entry('a')], size: 5, next: 'n' } })).toBe('✗ 5');
            expect(conflicts({ value: { values: [entry('a')], next: 'n' } })).toBe('✗ 1+');
        });

        it('shows ? when the conflicts could not be fetched', () => {
            expect(conflicts({ error: { message: 'fetch failed' } })).toBe('?');
        });
    });

    it('renders — in Builds and Conflicts for a pull request that was not checked', () => {
        const merged = { ...base, id: 7, state: 'MERGED' as const };
        const out = formatPullRequestList(
            [base, merged],
            [signals({ value: [status('FAILED')] }), null],
        );
        expect(row(out, 0)).toMatchObject({ Builds: '✗ 1 failed', Conflicts: '✓ none' });
        expect(row(out, 1)).toMatchObject({ ID: '#7', Builds: '—', Conflicts: '—' });
    });

    it('still escapes pipes in titles', () => {
        const piped = { ...base, title: 'a | b' };
        expect(formatPullRequestList([piped])).toContain('| a \\| b |');
        expect(formatPullRequestList([piped], [signals()])).toContain('| a \\| b |');
        expect(formatMyPullRequestList([piped], [signals()])).toContain('| a \\| b |');
    });
});

describe('formatCommentList', () => {
    it('indents replies', () => {
        const top: BitbucketComment = {
            id: 1,
            content: { raw: 'top-level' },
            user: fakeUser,
            created_on: '2025-01-01T00:00:00Z',
            updated_on: '2025-01-01T00:00:00Z',
        };
        const reply: BitbucketComment = {
            id: 2,
            content: { raw: 'a reply' },
            user: fakeUser,
            parent: { id: 1 },
            created_on: '2025-01-01T00:00:00Z',
            updated_on: '2025-01-01T00:00:00Z',
        };
        const out = formatCommentList([top, reply]);
        const lines = out.split('\n');
        const topLine = lines.find(l => l.includes('#1'));
        const replyLine = lines.find(l => l.includes('#2'));
        expect(topLine).toBeDefined();
        expect(replyLine).toBeDefined();
        // reply is more indented than top
        expect(replyLine!.match(/^ */)![0].length).toBeGreaterThan(
            topLine!.match(/^ */)![0].length,
        );
    });

    it('shows inline anchor', () => {
        const c: BitbucketComment = {
            id: 1,
            content: { raw: 'note' },
            user: fakeUser,
            inline: { path: 'src/foo.ts', to: 10 },
            created_on: '2025-01-01T00:00:00Z',
            updated_on: '2025-01-01T00:00:00Z',
        };
        expect(formatCommentList([c])).toContain('on src/foo.ts:10');
    });

    it('marks resolved threads with resolver', () => {
        const c: BitbucketComment = {
            id: 1,
            content: { raw: 'needs work' },
            user: fakeUser,
            created_on: '2025-01-01T00:00:00Z',
            updated_on: '2025-01-01T00:00:00Z',
            resolution: {
                type: 'pullrequest_comment_resolution',
                user: fakeUser,
                created_on: '2025-01-03T00:00:00Z',
            },
        };
        const out = formatCommentList([c]);
        expect(out).toContain('resolved');
        expect(out).toContain('Alice');
    });

    it('does not mark open threads as resolved', () => {
        const c: BitbucketComment = {
            id: 1,
            content: { raw: 'still open' },
            user: fakeUser,
            created_on: '2025-01-01T00:00:00Z',
            updated_on: '2025-01-01T00:00:00Z',
        };
        expect(formatCommentList([c])).not.toContain('resolved');
    });
});

describe('formatTaskList', () => {
    it('uses checkbox for resolved/unresolved', () => {
        const tasks: BitbucketTask[] = [
            {
                id: 1,
                content: { raw: 'unresolved' },
                state: 'UNRESOLVED',
                creator: fakeUser,
                created_on: '2025-01-01T00:00:00Z',
                updated_on: '2025-01-01T00:00:00Z',
            },
            {
                id: 2,
                content: { raw: 'resolved' },
                state: 'RESOLVED',
                creator: fakeUser,
                created_on: '2025-01-01T00:00:00Z',
                updated_on: '2025-01-01T00:00:00Z',
            },
        ];
        const out = formatTaskList(tasks);
        expect(out).toContain('[ ] **#1**');
        expect(out).toContain('[x] **#2**');
    });

    it('shows linked comment', () => {
        const t: BitbucketTask = {
            id: 1,
            content: { raw: 'fix' },
            state: 'UNRESOLVED',
            creator: fakeUser,
            comment: { id: 100 },
            created_on: '2025-01-01T00:00:00Z',
            updated_on: '2025-01-01T00:00:00Z',
        };
        expect(formatTaskList([t])).toContain('on comment #100');
    });
});

describe('formatPipelineList', () => {
    it('renders pipeline rows', () => {
        const p: BitbucketPipeline = {
            uuid: 'abc',
            build_number: 42,
            state: { name: 'COMPLETED', result: { name: 'SUCCESSFUL' } },
            target: { ref_name: 'main', ref_type: 'branch' },
            created_on: '2025-01-01T00:00:00Z',
            duration_in_seconds: 90,
        };
        const out = formatPipelineList([p]);
        expect(out).toContain('#42');
        expect(out).toContain('main');
        expect(out).toContain('SUCCESSFUL');
        expect(out).toContain('1m30s');
    });
});

describe('formatStepList', () => {
    it('renders step rows', () => {
        const s: BitbucketPipelineStep = {
            uuid: 'step-1',
            name: 'Build',
            state: { name: 'IN_PROGRESS' },
            duration_in_seconds: 5,
        };
        const out = formatStepList([s]);
        expect(out).toContain('Build');
        expect(out).toContain('IN_PROGRESS');
    });
});

describe('formatMembers', () => {
    it('renders member account ids', () => {
        const m: BitbucketWorkspaceMember = {
            user: { ...fakeUser, account_id: 'a:b:c' },
        };
        expect(formatMembers([m])).toContain('a:b:c');
    });
});

describe('formatAccount', () => {
    it('renders the account id', () => {
        const out = formatAccount({
            account_id: 'acct-99',
            display_name: 'Alice',
            username: 'alice',
        });
        expect(out).toContain('Alice');
        expect(out).toContain('acct-99');
    });
});

describe('formatBranchList', () => {
    it('renders name and short head', () => {
        const out = formatBranchList([{ name: 'main', target: { hash: 'abcdef1234567890' } }]);
        expect(out).toContain('main');
        expect(out).toContain('abcdef1');
    });

    it('renders empty', () => {
        expect(formatBranchList([])).toBe('_No branches._');
    });
});

describe('formatCommitList', () => {
    it('renders hash, author and first line of message', () => {
        const c: BitbucketCommit = {
            hash: 'ab12cd34ef90',
            message: 'Fix the thing\n\nlong body',
            date: '2025-01-01T00:00:00Z',
            author: { user: fakeUser },
        };
        const out = formatCommitList([c]);
        expect(out).toContain('ab12cd3');
        expect(out).toContain('Alice');
        expect(out).toContain('Fix the thing');
        expect(out).not.toContain('long body');
    });
});

describe('formatDiffStat', () => {
    it('renders per-file add/remove counts', () => {
        const entries: BitbucketDiffStatEntry[] = [
            { status: 'modified', lines_added: 3, lines_removed: 1, new: { path: 'a.ts' } },
        ];
        const out = formatDiffStat(entries);
        expect(out).toContain('a.ts');
        expect(out).toContain('+3');
        expect(out).toContain('−1');
    });
});

describe('formatSrcList', () => {
    it('marks directories with a trailing slash', () => {
        const entries: BitbucketSrcEntry[] = [
            { type: 'commit_directory', path: 'src' },
            { type: 'commit_file', path: 'README.md', size: 12 },
        ];
        const out = formatSrcList(entries);
        expect(out).toContain('src/');
        expect(out).toContain('README.md');
    });
});

describe('formatStatusList', () => {
    it('groups statuses by commit and shows state', () => {
        const statuses: BitbucketCommitStatus[] = [
            { key: 'build', state: 'SUCCESSFUL', name: 'Build', commit: { hash: 'abc1234' } },
            { key: 'lint', state: 'FAILED', name: 'Lint', commit: { hash: 'abc1234' } },
        ];
        const out = formatStatusList(statuses);
        expect(out).toContain('abc1234');
        expect(out).toContain('SUCCESSFUL');
        expect(out).toContain('FAILED');
    });
});

describe('formatReviewers', () => {
    const reviewer = (name: string, approved: boolean): BitbucketParticipant => ({
        user: { ...fakeUser, display_name: name },
        role: 'REVIEWER',
        approved,
        state: approved ? 'approved' : null,
    });

    it('renders all reviewers with approval state', () => {
        const out = formatReviewers([reviewer('Alice', true), reviewer('Bob', false)]);
        expect(out).toContain('Alice');
        expect(out).toContain('Bob');
        expect(out).toContain('approved');
        expect(out).toContain('pending');
    });

    it('--pending filters to non-approvers', () => {
        const out = formatReviewers([reviewer('Alice', true), reviewer('Bob', false)], true);
        expect(out).not.toContain('Alice');
        expect(out).toContain('Bob');
    });

    it('includes PARTICIPANTs, not only assigned reviewers', () => {
        const participant: BitbucketParticipant = {
            user: { ...fakeUser, display_name: 'Carol' },
            role: 'PARTICIPANT',
            approved: true,
            state: 'approved',
        };
        const out = formatReviewers([participant, reviewer('Alice', false)]);
        expect(out).toContain('Carol');
        expect(out).toContain('Alice');
        // assigned reviewers sort ahead of plain participants
        expect(out.indexOf('Alice')).toBeLessThan(out.indexOf('Carol'));
    });
});
