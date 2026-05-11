/**
 * Minimal parser for `sonar-project.properties`.
 *
 * Intentionally simple: split on the first `=`, trim, skip blank lines and
 * `#`-prefixed comments. No support for Java `.properties` line continuations,
 * unicode escapes, or `!` comments — sonar-project.properties files in practice
 * are plain key=value lists and the complexity is not justified.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const SONAR_PROPERTIES_FILENAME = 'sonar-project.properties';

/**
 * Walk up from `startDir` looking for `sonar-project.properties`.
 * Returns the absolute path to the file or null if not found before reaching the root.
 */
export function findProperties(startDir: string): string | null {
    let dir = resolve(startDir);
    while (true) {
        const candidate = resolve(dir, SONAR_PROPERTIES_FILENAME);
        if (existsSync(candidate)) return candidate;
        const parent = dirname(dir);
        if (parent === dir) return null;
        dir = parent;
    }
}

/**
 * Parse properties file contents into a key/value map.
 * Duplicate keys: last occurrence wins.
 */
export function parseProperties(contents: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const rawLine of contents.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        const value = line.slice(eq + 1).trim();
        if (!key) continue;
        result[key] = value;
    }
    return result;
}

/**
 * Locate and parse `sonar-project.properties` walking up from `startDir`.
 * Returns the parsed map plus the path it was loaded from, or null when no file is found.
 *
 * The returned `searched` list is the directories walked, used to build a helpful
 * error message when the file is missing.
 */
export function loadProperties(startDir: string): {
    path: string;
    values: Record<string, string>;
} | null {
    const path = findProperties(startDir);
    if (!path) return null;
    const contents = readFileSync(path, 'utf-8');
    return { path, values: parseProperties(contents) };
}

/**
 * The list of directories that would be searched walking up from `startDir`.
 * Useful for "no properties file found" error messages.
 */
export function propertiesSearchPath(startDir: string): string[] {
    const dirs: string[] = [];
    let dir = resolve(startDir);
    while (true) {
        dirs.push(dir);
        const parent = dirname(dir);
        if (parent === dir) return dirs;
        dir = parent;
    }
}
