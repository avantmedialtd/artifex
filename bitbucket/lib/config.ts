/**
 * Bitbucket workspace + repository resolution.
 *
 * Order of precedence (first hit wins):
 *   1. Explicit flags (--workspace / --repo)
 *   2. af.json: bitbucket.workspace / bitbucket.repo
 *   3. Parsed from `git remote get-url origin` if it points at bitbucket.org
 *   4. Throws with help text
 */

import { execSync } from 'node:child_process';
import { loadAfConfig } from '../../utils/config.ts';

export interface BitbucketTarget {
    workspace: string;
    repo: string;
}

export interface ResolveTargetOptions {
    workspace?: string;
    repo?: string;
}

export const BITBUCKET_REMOTE_PATTERN =
    /(?:^|@|\/\/)bitbucket\.org[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/;

/**
 * Parse a git remote URL and return workspace/repo if it points at bitbucket.org.
 *
 * Accepts:
 *   - https://bitbucket.org/workspace/repo
 *   - https://bitbucket.org/workspace/repo.git
 *   - git@bitbucket.org:workspace/repo.git
 *   - ssh://git@bitbucket.org/workspace/repo
 */
export function parseBitbucketRemote(remoteUrl: string): BitbucketTarget | null {
    const match = remoteUrl.match(BITBUCKET_REMOTE_PATTERN);
    if (!match) return null;
    const [, workspace, repo] = match;
    if (!workspace || !repo) return null;
    return { workspace, repo };
}

/**
 * Read the origin remote via `git remote get-url origin`.
 * Returns null if not a git repo or no origin remote.
 */
export function readGitOriginRemote(): string | null {
    try {
        const url = execSync('git remote get-url origin', {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        return url.trim() || null;
    } catch {
        return null;
    }
}

/**
 * Resolve the target workspace and repo using the 3-layer precedence rule.
 * Throws when no source supplies values.
 */
export function resolveTarget(opts: ResolveTargetOptions = {}): BitbucketTarget {
    if (opts.workspace && opts.repo) {
        return { workspace: opts.workspace, repo: opts.repo };
    }

    const af = loadAfConfig();
    const fromConfig = af?.bitbucket;
    if (fromConfig?.workspace && fromConfig?.repo) {
        return {
            workspace: opts.workspace ?? fromConfig.workspace,
            repo: opts.repo ?? fromConfig.repo,
        };
    }

    const remote = readGitOriginRemote();
    if (remote) {
        const parsed = parseBitbucketRemote(remote);
        if (parsed) {
            return {
                workspace: opts.workspace ?? parsed.workspace,
                repo: opts.repo ?? parsed.repo,
            };
        }
    }

    throw new Error(
        'Could not resolve Bitbucket workspace and repo. Provide one of:\n' +
            '  1. --workspace <ws> --repo <r> flags\n' +
            '  2. bitbucket.workspace and bitbucket.repo in af.json\n' +
            '  3. A git origin remote pointing at bitbucket.org',
    );
}

/**
 * Resolve just the workspace, using the same precedence as `resolveTarget` but
 * without requiring a repository. Used by workspace-scoped commands such as
 * `repo list`, which list repositories within a workspace.
 */
export function resolveWorkspace(opts: ResolveTargetOptions = {}): string {
    if (opts.workspace) return opts.workspace;

    const af = loadAfConfig();
    if (af?.bitbucket?.workspace) return af.bitbucket.workspace;

    const remote = readGitOriginRemote();
    if (remote) {
        const parsed = parseBitbucketRemote(remote);
        if (parsed) return parsed.workspace;
    }

    throw new Error(
        'Could not resolve a Bitbucket workspace. Provide one of:\n' +
            '  1. --workspace <ws> flag\n' +
            '  2. bitbucket.workspace in af.json\n' +
            '  3. A git origin remote pointing at bitbucket.org',
    );
}
