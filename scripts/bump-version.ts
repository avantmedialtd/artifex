/**
 * Version bump for `@avantmedia/af`.
 *
 * `package.json` is the npm source of truth — npm publishes exactly its
 * `version` field — so this rewrites that one line (leaving the rest of the file
 * byte-identical, so `format:check` stays green). Releases are tag-driven: the
 * `/release` command commits this bump together with the release notes, tags the
 * commit, and pushes; the tag push triggers the publish workflow. This script
 * therefore edits a single file and does NOT commit or tag — keeping it
 * composable and its version math unit-testable.
 *
 * Usage:
 *   bun run bump <patch|minor|major|x.y.z> [--dry-run] [--force]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type SemVer = [number, number, number];

/** Parse a bare `x.y.z` (no leading `v`); returns null for anything else. */
export function parseSemVer(value: string): SemVer | null {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
    if (!m) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Negative if a < b, 0 if equal, positive if a > b. */
export function compare(a: SemVer, b: SemVer): number {
    for (let i = 0; i < 3; i++) {
        if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
}

export function format([major, minor, patch]: SemVer): string {
    return `${major}.${minor}.${patch}`;
}

/** Compute the next version from a bump keyword or an explicit `x.y.z`. */
export function nextVersion(current: SemVer, bump: string): SemVer {
    const [major, minor, patch] = current;
    switch (bump) {
        case 'major':
            return [major + 1, 0, 0];
        case 'minor':
            return [major, minor + 1, 0];
        case 'patch':
            return [major, minor, patch + 1];
        default: {
            const explicit = parseSemVer(bump);
            if (!explicit) {
                throw new Error(
                    `Invalid argument "${bump}". Expected patch | minor | major | x.y.z.`,
                );
            }
            return explicit;
        }
    }
}

function fail(message: string): never {
    process.stderr.write(`error: ${message}\n`);
    process.exit(1);
}

/** Read the package.json `version` field as a SemVer. */
function currentVersion(pkgText: string): SemVer {
    const m = /"version":\s*"([^"]+)"/.exec(pkgText);
    const parsed = m ? parseSemVer(m[1]) : null;
    if (!parsed) {
        fail('Could not read a semver "version" from package.json.');
    }
    return parsed;
}

function tagExists(tag: string): boolean {
    try {
        execFileSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], {
            stdio: 'ignore',
        });
        return true;
    } catch {
        // Non-zero exit means the tag does not exist — good.
        return false;
    }
}

function run(argv: string[]): void {
    const dryRun = argv.includes('--dry-run');
    const force = argv.includes('--force');
    const positional = argv.filter(a => !a.startsWith('--'));

    if (positional.length !== 1) {
        process.stderr.write(
            'usage: bun run bump <patch|minor|major|x.y.z> [--dry-run] [--force]\n',
        );
        process.exit(1);
    }
    const bump = positional[0];
    if (bump !== 'major' && bump !== 'minor' && bump !== 'patch' && !parseSemVer(bump)) {
        fail(`Invalid argument "${bump}". Expected patch | minor | major | x.y.z.`);
    }

    const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url));
    const pkgText = readFileSync(pkgPath, 'utf8');
    const current = currentVersion(pkgText);
    const next = nextVersion(current, bump);

    // For an explicit version, reject downgrades/equal unless --force.
    if (parseSemVer(bump) && compare(next, current) <= 0 && !force) {
        fail(
            `Refusing to set v${format(next)} — not greater than current v${format(current)}. ` +
                'Use --force to override.',
        );
    }

    const tag = `v${format(next)}`;
    if (tagExists(tag)) {
        fail(`Tag ${tag} already exists.`);
    }

    process.stdout.write(`v${format(current)} -> ${tag}\n`);

    if (dryRun) {
        process.stdout.write('(dry run — package.json not modified)\n');
        return;
    }

    // Rewrite only the version line so the rest of package.json stays byte-identical.
    const updated = pkgText.replace(/("version":\s*)"[^"]*"/, `$1"${format(next)}"`);
    if (updated === pkgText) {
        fail('Failed to rewrite the version field in package.json.');
    }
    writeFileSync(pkgPath, updated);
    process.stdout.write(`Updated package.json to ${format(next)}.\n`);
}

// Standalone execution for direct script usage (Bun sets import.meta.main).
// Guarded so the unit tests can import the pure helpers with no side effects.
if ((import.meta as { main?: boolean }).main) {
    run(process.argv.slice(2));
}
