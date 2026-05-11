import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getSonarConfig, SonarConfigError } from './config.ts';
import { SONAR_PROPERTIES_FILENAME } from './properties.ts';

describe('getSonarConfig', () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), 'af-sonar-config-'));
    });

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true });
    });

    function writeProps(contents: string): void {
        writeFileSync(join(cwd, SONAR_PROPERTIES_FILENAME), contents);
    }

    it('resolves baseUrl, projectKey, token from env when all set', () => {
        const config = getSonarConfig({
            cwd,
            env: {
                SONAR_TOKEN: 'tok',
                SONAR_BASE_URL: 'https://sonar.example.com',
            },
            projectFlag: 'myorg_artifex',
        });
        expect(config).toEqual({
            baseUrl: 'https://sonar.example.com',
            projectKey: 'myorg_artifex',
            token: 'tok',
            propertiesPath: null,
        });
    });

    it('falls back to properties file for baseUrl', () => {
        writeProps('sonar.host.url=https://from-file.example.com\nsonar.projectKey=K');
        const config = getSonarConfig({
            cwd,
            env: { SONAR_TOKEN: 'tok' },
        });
        expect(config.baseUrl).toBe('https://from-file.example.com');
        expect(config.projectKey).toBe('K');
        expect(config.propertiesPath).toBe(join(cwd, SONAR_PROPERTIES_FILENAME));
    });

    it('prefers env baseUrl over properties file', () => {
        writeProps('sonar.host.url=https://from-file/\nsonar.projectKey=K');
        const config = getSonarConfig({
            cwd,
            env: { SONAR_TOKEN: 'tok', SONAR_BASE_URL: 'https://from-env' },
        });
        expect(config.baseUrl).toBe('https://from-env');
    });

    it('prefers --project flag over properties file projectKey', () => {
        writeProps('sonar.host.url=https://s/\nsonar.projectKey=props_key');
        const config = getSonarConfig({
            cwd,
            env: { SONAR_TOKEN: 'tok' },
            projectFlag: 'flag_key',
        });
        expect(config.projectKey).toBe('flag_key');
    });

    it('strips trailing slashes from baseUrl', () => {
        const config = getSonarConfig({
            cwd,
            env: { SONAR_TOKEN: 'tok', SONAR_BASE_URL: 'https://sonar.example.com///' },
            projectFlag: 'K',
        });
        expect(config.baseUrl).toBe('https://sonar.example.com');
    });

    it('throws when SONAR_TOKEN is missing', () => {
        expect(() =>
            getSonarConfig({
                cwd,
                env: { SONAR_BASE_URL: 'https://s/' },
                projectFlag: 'K',
            }),
        ).toThrow(/SONAR_TOKEN is not set/);
    });

    it('throws when baseUrl cannot be resolved', () => {
        expect(() =>
            getSonarConfig({
                cwd,
                env: { SONAR_TOKEN: 'tok' },
                projectFlag: 'K',
            }),
        ).toThrow(/base URL could not be resolved/);
    });

    it('throws when projectKey cannot be resolved', () => {
        expect(() =>
            getSonarConfig({
                cwd,
                env: { SONAR_TOKEN: 'tok', SONAR_BASE_URL: 'https://s/' },
            }),
        ).toThrow(/project key could not be resolved/);
    });

    it('errors are SonarConfigError', () => {
        try {
            getSonarConfig({ cwd, env: {} });
            expect.fail('expected SonarConfigError');
        } catch (err) {
            expect(err).toBeInstanceOf(SonarConfigError);
        }
    });
});
