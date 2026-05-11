import { describe, it, expect } from 'vitest';
import {
    formatCommentList,
    formatMembers,
    formatPipelineList,
    formatPullRequestList,
    formatStepList,
    formatTaskList,
} from './formatters.ts';
import type {
    BitbucketComment,
    BitbucketPipeline,
    BitbucketPipelineStep,
    BitbucketPullRequest,
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
