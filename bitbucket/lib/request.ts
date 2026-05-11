/**
 * Bitbucket-specific authenticated request wrappers.
 *
 * Bitbucket Cloud does NOT accept Atlassian API tokens by default — the
 * tokens generated for Jira/Confluence are scoped to those products and
 * return 401 against api.bitbucket.org. A separate Bitbucket-specific
 * credential is required:
 *
 *   - Workspace API token (recommended for automation):
 *       https://bitbucket.org/<workspace>/workspace/settings/api-tokens
 *   - Repository access token (scoped to a single repo)
 *   - App password (legacy, being deprecated):
 *       https://bitbucket.org/account/settings/app-passwords/
 *
 * Configure via environment variables:
 *   BITBUCKET_USERNAME=<bitbucket username or workspace token label>
 *   BITBUCKET_API_TOKEN=<workspace API token / app password>
 *
 * `BITBUCKET_USERNAME` falls back to `ATLASSIAN_EMAIL` then `JIRA_EMAIL`
 * since the email address is often accepted as the username for app
 * passwords. `BITBUCKET_APP_PASSWORD` is also accepted as a legacy alias
 * for `BITBUCKET_API_TOKEN`.
 *
 * The actual HTTP work is delegated to atlassian/lib/request.ts; we only
 * override the Authorization header here.
 */

import {
    paginate as sharedPaginate,
    request as sharedRequest,
    requestText as sharedRequestText,
} from '../../atlassian/lib/request.ts';

let _authHeader: string | null = null;

export function getBitbucketAuthHeader(): string {
    if (_authHeader) return _authHeader;

    const username =
        process.env.BITBUCKET_USERNAME ?? process.env.ATLASSIAN_EMAIL ?? process.env.JIRA_EMAIL;
    const token = process.env.BITBUCKET_API_TOKEN ?? process.env.BITBUCKET_APP_PASSWORD;

    if (!username || !token) {
        throw new Error(
            'Bitbucket credentials not set. Bitbucket Cloud requires a separate token from Jira/Confluence:\n' +
                '  BITBUCKET_USERNAME=<bitbucket username or workspace token label>\n' +
                '  BITBUCKET_API_TOKEN=<workspace API token or app password>\n\n' +
                'Generate a workspace API token in Bitbucket: ' +
                'https://bitbucket.org/<workspace>/workspace/settings/api-tokens\n' +
                'BITBUCKET_USERNAME falls back to ATLASSIAN_EMAIL/JIRA_EMAIL when unset.',
        );
    }

    _authHeader = `Basic ${Buffer.from(`${username}:${token}`).toString('base64')}`;
    return _authHeader;
}

/** Reset cached auth header (used by tests). */
export function resetBitbucketAuthCache(): void {
    _authHeader = null;
}

function withBitbucketAuth(options: RequestInit = {}): RequestInit {
    return {
        ...options,
        headers: {
            ...(options.headers as Record<string, string> | undefined),
            Authorization: getBitbucketAuthHeader(),
        },
    };
}

export async function bbRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
    return sharedRequest<T>(url, withBitbucketAuth(options));
}

export async function bbRequestText(url: string, options: RequestInit = {}): Promise<string> {
    return sharedRequestText(url, withBitbucketAuth(options));
}

/**
 * Walk a Bitbucket Cloud cursor-paginated endpoint with Bitbucket auth.
 * Mirrors `paginate` from atlassian/lib but uses Bitbucket credentials.
 */
export async function* bbPaginate<T>(url: string): AsyncIterable<T> {
    let nextUrl: string | undefined = url;
    while (nextUrl) {
        const page: { values?: T[]; next?: string } = await bbRequest<{
            values?: T[];
            next?: string;
        }>(nextUrl);
        if (page.values) {
            for (const value of page.values) {
                yield value;
            }
        }
        nextUrl = page.next;
    }
}

// Re-export the shared paginate type alongside, so callers that don't need
// auth (none, currently) can still reach for it — kept for symmetry only.
export { sharedPaginate as paginateNoAuth };
