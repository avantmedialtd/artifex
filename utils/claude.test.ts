import { afterEach, describe, expect, it } from 'vitest';
import { getAgentCommand } from './claude.ts';

describe('claude utilities', () => {
    const originalEnv = process.env.ARTIFEX_AGENT;

    afterEach(() => {
        // Restore original environment variable
        if (originalEnv === undefined) {
            delete process.env.ARTIFEX_AGENT;
        } else {
            process.env.ARTIFEX_AGENT = originalEnv;
        }
    });

    describe('getAgentCommand', () => {
        it('should return "claude" by default when ARTIFEX_AGENT is not set', () => {
            delete process.env.ARTIFEX_AGENT;
            expect(getAgentCommand()).toBe('claude');
        });

        it('should return ARTIFEX_AGENT value when set', () => {
            process.env.ARTIFEX_AGENT = 'custom-agent';
            expect(getAgentCommand()).toBe('custom-agent');
        });

        it('should handle absolute paths in ARTIFEX_AGENT', () => {
            process.env.ARTIFEX_AGENT = '/usr/local/bin/my-agent';
            expect(getAgentCommand()).toBe('/usr/local/bin/my-agent');
        });

        it('should handle empty string as ARTIFEX_AGENT', () => {
            process.env.ARTIFEX_AGENT = '';
            // Empty string is falsy, should fall back to 'claude'
            expect(getAgentCommand()).toBe('claude');
        });
    });
});
