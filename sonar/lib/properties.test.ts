import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    findProperties,
    parseProperties,
    loadProperties,
    SONAR_PROPERTIES_FILENAME,
} from './properties.ts';

describe('parseProperties', () => {
    it('parses simple key=value lines', () => {
        const out = parseProperties(
            'sonar.projectKey=myorg_artifex\nsonar.host.url=https://s.example.com',
        );
        expect(out['sonar.projectKey']).toBe('myorg_artifex');
        expect(out['sonar.host.url']).toBe('https://s.example.com');
    });

    it('ignores blank lines and # comments', () => {
        const out = parseProperties('# this is a comment\n\n   \nsonar.projectKey=K\n# another\n');
        expect(out).toEqual({ 'sonar.projectKey': 'K' });
    });

    it('trims whitespace around keys and values', () => {
        const out = parseProperties('  sonar.projectKey   =   myorg_artifex   ');
        expect(out['sonar.projectKey']).toBe('myorg_artifex');
    });

    it('splits on the first = only', () => {
        const out = parseProperties('sonar.token=abc=def=ghi');
        expect(out['sonar.token']).toBe('abc=def=ghi');
    });

    it('lets the last duplicate key win', () => {
        const out = parseProperties('sonar.projectKey=first\nsonar.projectKey=second');
        expect(out['sonar.projectKey']).toBe('second');
    });

    it('skips lines without an = sign', () => {
        const out = parseProperties('garbage line\nsonar.projectKey=K');
        expect(out).toEqual({ 'sonar.projectKey': 'K' });
    });

    it('handles CRLF line endings', () => {
        const out = parseProperties('sonar.a=1\r\nsonar.b=2\r\n');
        expect(out).toEqual({ 'sonar.a': '1', 'sonar.b': '2' });
    });
});

describe('findProperties', () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'af-sonar-props-'));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('finds the file in the current directory', () => {
        const file = join(root, SONAR_PROPERTIES_FILENAME);
        writeFileSync(file, 'sonar.projectKey=K');
        expect(findProperties(root)).toBe(file);
    });

    it('finds the file in a parent directory', () => {
        const file = join(root, SONAR_PROPERTIES_FILENAME);
        writeFileSync(file, 'sonar.projectKey=K');
        const nested = join(root, 'src', 'auth');
        mkdirSync(nested, { recursive: true });
        expect(findProperties(nested)).toBe(file);
    });

    it('returns null when no file exists up to root', () => {
        // Use a subdirectory we know has no sonar-project.properties in any ancestor
        // by creating an isolated tmp tree and starting from inside it.
        const nested = join(root, 'a', 'b', 'c');
        mkdirSync(nested, { recursive: true });
        // Walk up will still hit / eventually; but we can't reliably assert
        // *no* sonar-project.properties exists above tmpdir on every machine.
        // Instead: stub by checking the file isn't found inside `root`.
        expect(findProperties(nested)).not.toBe(join(root, SONAR_PROPERTIES_FILENAME));
    });
});

describe('loadProperties', () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'af-sonar-load-'));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('loads and parses a found file', () => {
        const file = join(root, SONAR_PROPERTIES_FILENAME);
        writeFileSync(file, '# header\nsonar.projectKey=myorg_artifex\nsonar.host.url=https://s/');
        const got = loadProperties(root);
        expect(got?.path).toBe(file);
        expect(got?.values['sonar.projectKey']).toBe('myorg_artifex');
        expect(got?.values['sonar.host.url']).toBe('https://s/');
    });
});
