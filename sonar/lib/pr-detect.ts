/**
 * Auto-detect a Bitbucket pull request id for the current git branch.
 *
 * Used by `af sonar pr` when the user omits the PR id. Calls into
 * `bitbucket/lib/` to keep PR lookup logic in one place.
 *
 * Distinguishes outcomes so the command layer can render targeted error messages:
 *   - `{ kind: 'single', id }`     — exactly one open PR found
 *   - `{ kind: 'none', branch }`   — no open PRs for the branch
 *   - `{ kind: 'ambiguous', ... }` — multiple open PRs for the branch
 *   - `{ kind: 'no-branch' }`      — couldn't determine current branch (detached HEAD, not a repo)
 *   - `{ kind: 'no-credentials' }` — Bitbucket auth env vars missing
 *   - `{ kind: 'error', message }` — any other failure
 */

import {
    getCurrentBranch as bbGetCurrentBranch,
    listPullRequests,
} from '../../bitbucket/lib/client.ts';
import { resolveTarget } from '../../bitbucket/lib/config.ts';
import type { BitbucketPullRequest } from '../../bitbucket/lib/types.ts';

export interface DetectedSingle {
    kind: 'single';
    id: number;
    title: string;
    branch: string;
}

export interface DetectedNone {
    kind: 'none';
    branch: string;
}

export interface DetectedAmbiguous {
    kind: 'ambiguous';
    branch: string;
    candidates: Array<{ id: number; title: string }>;
}

export interface DetectedNoBranch {
    kind: 'no-branch';
}

export interface DetectedNoCredentials {
    kind: 'no-credentials';
}

export interface DetectedError {
    kind: 'error';
    message: string;
}

export type DetectedPR =
    | DetectedSingle
    | DetectedNone
    | DetectedAmbiguous
    | DetectedNoBranch
    | DetectedNoCredentials
    | DetectedError;

export interface DetectPRDependencies {
    getCurrentBranch?: () => string | null;
    listOpenPRsForBranch?: (branch: string) => Promise<BitbucketPullRequest[]>;
}

/**
 * Detect the PR for the current branch. Optional dependency injection makes the
 * function fully testable without a real git repo or Bitbucket account.
 */
export async function detectPullRequestForCurrentBranch(
    deps: DetectPRDependencies = {},
): Promise<DetectedPR> {
    const getBranch = deps.getCurrentBranch ?? bbGetCurrentBranch;
    const branch = getBranch();
    if (!branch) return { kind: 'no-branch' };

    let prs: BitbucketPullRequest[];
    try {
        const lookup = deps.listOpenPRsForBranch ?? defaultListOpenPRsForBranch;
        prs = await lookup(branch);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/credentials not set/i.test(message) || /BITBUCKET_/i.test(message)) {
            return { kind: 'no-credentials' };
        }
        return { kind: 'error', message };
    }

    if (prs.length === 0) return { kind: 'none', branch };
    if (prs.length === 1) {
        const pr = prs[0];
        return { kind: 'single', id: pr.id, title: pr.title, branch };
    }
    return {
        kind: 'ambiguous',
        branch,
        candidates: prs.map(pr => ({ id: pr.id, title: pr.title })),
    };
}

async function defaultListOpenPRsForBranch(branch: string): Promise<BitbucketPullRequest[]> {
    const target = resolveTarget();
    return listPullRequests(target.workspace, target.repo, {
        state: 'OPEN',
        q: `source.branch.name="${branch}"`,
    });
}

/**
 * Format a detect result that is not `single` into a human-readable error message
 * suitable for printing via `error()`. The command layer maps this to exit code 1.
 */
export function explainDetectFailure(result: Exclude<DetectedPR, DetectedSingle>): string {
    switch (result.kind) {
        case 'none':
            return (
                `No open Bitbucket pull request found for branch '${result.branch}'.\n` +
                'Pass the PR id explicitly: af sonar pr <id>'
            );
        case 'ambiguous': {
            const list = result.candidates.map(c => `  #${c.id}  ${c.title}`).join('\n');
            return (
                `Multiple open Bitbucket pull requests found for branch '${result.branch}':\n` +
                list +
                '\nPass the PR id explicitly: af sonar pr <id>'
            );
        }
        case 'no-branch':
            return (
                'Could not determine the current git branch (detached HEAD or not a git repo).\n' +
                'Pass the PR id explicitly: af sonar pr <id>'
            );
        case 'no-credentials':
            return (
                'Auto-detecting the PR id requires Bitbucket credentials, but BITBUCKET_API_TOKEN is not set.\n' +
                'Either configure Bitbucket env vars (see `af help bb`) or pass the PR id explicitly: af sonar pr <id>'
            );
        case 'error':
            return `PR auto-detect failed: ${result.message}\nPass the PR id explicitly: af sonar pr <id>`;
    }
}
