import { describe, it, expect } from 'vitest';
import {
    formatAccount,
    formatBranchList,
    formatCommentList,
    formatCommitList,
    formatDiffStat,
    formatMembers,
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
