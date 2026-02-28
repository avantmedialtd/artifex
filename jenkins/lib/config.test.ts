import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getJenkinsConfig } from './config.ts';

describe('jenkins config', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        delete process.env.JENKINS_BASE_URL;
        delete process.env.JENKINS_USER;
        delete process.env.JENKINS_API_TOKEN;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should read JENKINS_* variables', () => {
        process.env.JENKINS_BASE_URL = 'https://jenkins.example.com';
        process.env.JENKINS_USER = 'admin';
        process.env.JENKINS_API_TOKEN = 'token123';

        const config = getJenkinsConfig();

        expect(config.baseUrl).toBe('https://jenkins.example.com');
        expect(config.user).toBe('admin');
        expect(config.apiToken).toBe('token123');
    });

    it('should strip trailing slash from base URL', () => {
        process.env.JENKINS_BASE_URL = 'https://jenkins.example.com/';
        process.env.JENKINS_USER = 'admin';
        process.env.JENKINS_API_TOKEN = 'token123';

        const config = getJenkinsConfig();

        expect(config.baseUrl).toBe('https://jenkins.example.com');
    });

    it('should throw when JENKINS_BASE_URL is not set', () => {
        process.env.JENKINS_USER = 'admin';
        process.env.JENKINS_API_TOKEN = 'token123';

        expect(() => getJenkinsConfig()).toThrow('JENKINS_BASE_URL is not set');
    });

    it('should throw when JENKINS_USER is not set', () => {
        process.env.JENKINS_BASE_URL = 'https://jenkins.example.com';
        process.env.JENKINS_API_TOKEN = 'token123';

        expect(() => getJenkinsConfig()).toThrow('JENKINS_USER is not set');
    });

    it('should throw when JENKINS_API_TOKEN is not set', () => {
        process.env.JENKINS_BASE_URL = 'https://jenkins.example.com';
        process.env.JENKINS_USER = 'admin';

        expect(() => getJenkinsConfig()).toThrow('JENKINS_API_TOKEN is not set');
    });
});
