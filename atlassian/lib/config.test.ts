import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAtlassianConfig } from './config.ts';

describe('atlassian config', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        // Clear all relevant env vars
        delete process.env.ATLASSIAN_BASE_URL;
        delete process.env.ATLASSIAN_EMAIL;
        delete process.env.ATLASSIAN_API_TOKEN;
        delete process.env.JIRA_BASE_URL;
        delete process.env.JIRA_EMAIL;
        delete process.env.JIRA_API_TOKEN;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should read ATLASSIAN_* variables', () => {
        process.env.ATLASSIAN_BASE_URL = 'https://test.atlassian.net';
        process.env.ATLASSIAN_EMAIL = 'user@test.com';
        process.env.ATLASSIAN_API_TOKEN = 'token123';

        const config = getAtlassianConfig();

        expect(config.baseUrl).toBe('https://test.atlassian.net');
        expect(config.email).toBe('user@test.com');
        expect(config.apiToken).toBe('token123');
    });

    it('should fall back to JIRA_* variables when ATLASSIAN_* not set', () => {
        process.env.JIRA_BASE_URL = 'https://legacy.atlassian.net';
        process.env.JIRA_EMAIL = 'legacy@test.com';
        process.env.JIRA_API_TOKEN = 'legacy-token-123';

        const config = getAtlassianConfig();

        expect(config.baseUrl).toBe('https://legacy.atlassian.net');
        expect(config.email).toBe('legacy@test.com');
        expect(config.apiToken).toBe('legacy-token-123');
    });

    it('should prefer ATLASSIAN_* over JIRA_* when both are set', () => {
        process.env.ATLASSIAN_BASE_URL = 'https://new.atlassian.net';
        process.env.ATLASSIAN_EMAIL = 'new@test.com';
        process.env.ATLASSIAN_API_TOKEN = 'new-token-456';
        process.env.JIRA_BASE_URL = 'https://old.atlassian.net';
        process.env.JIRA_EMAIL = 'old@test.com';
        process.env.JIRA_API_TOKEN = 'old-token-789';

        const config = getAtlassianConfig();

        expect(config.baseUrl).toBe('https://new.atlassian.net');
        expect(config.email).toBe('new@test.com');
        expect(config.apiToken).toBe('new-token-456');
    });

    it('should strip trailing slash from base URL', () => {
        process.env.ATLASSIAN_BASE_URL = 'https://test.atlassian.net/';
        process.env.ATLASSIAN_EMAIL = 'user@test.com';
        process.env.ATLASSIAN_API_TOKEN = 'token123';

        const config = getAtlassianConfig();

        expect(config.baseUrl).toBe('https://test.atlassian.net');
    });

    it('should throw when neither ATLASSIAN_* nor JIRA_* vars are set', () => {
        expect(() => getAtlassianConfig()).toThrow('ATLASSIAN_BASE_URL is not set');
    });

    it('should include all legacy variable names in error message', () => {
        expect(() => getAtlassianConfig()).toThrow('JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN');
    });
});
