import { afterEach, describe, expect, it } from 'vitest';
import { getAgentCommand } from './claude.ts';

describe('claude utilities', () => {
    const originalEnv = process.env.ZAP_AGENT;

    afterEach(() => {
        // Restore original environment variable
        if (originalEnv === undefined) {
            delete process.env.ZAP_AGENT;
        } else {
            process.env.ZAP_AGENT = originalEnv;
        }
    });

    describe('getAgentCommand', () => {
        it('should return "claude" by default when ZAP_AGENT is not set', () => {
            delete process.env.ZAP_AGENT;
            expect(getAgentCommand()).toBe('claude');
        });

        it('should return ZAP_AGENT value when set', () => {
            process.env.ZAP_AGENT = 'custom-agent';
            expect(getAgentCommand()).toBe('custom-agent');
        });

        it('should handle absolute paths in ZAP_AGENT', () => {
            process.env.ZAP_AGENT = '/usr/local/bin/my-agent';
            expect(getAgentCommand()).toBe('/usr/local/bin/my-agent');
        });

        it('should handle empty string as ZAP_AGENT', () => {
            process.env.ZAP_AGENT = '';
            // Empty string is falsy, should fall back to 'claude'
            expect(getAgentCommand()).toBe('claude');
        });
    });
});
