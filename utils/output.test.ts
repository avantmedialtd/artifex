import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { success, error, info, warn, header, section, listItem, colors } from './output.ts';

describe('output utilities', () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('colors', () => {
        it('should have correct ANSI codes', () => {
            expect(colors.reset).toBe('\x1b[0m');
            expect(colors.red).toBe('\x1b[31m');
            expect(colors.green).toBe('\x1b[32m');
            expect(colors.yellow).toBe('\x1b[33m');
            expect(colors.blue).toBe('\x1b[34m');
            expect(colors.cyan).toBe('\x1b[36m');
            expect(colors.gray).toBe('\x1b[90m');
        });
    });

    describe('success', () => {
        it('should output green message', () => {
            success('Test success');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                `${colors.green}Test success${colors.reset}`,
            );
        });

        it('should handle empty string', () => {
            success('');
            expect(consoleLogSpy).toHaveBeenCalledWith(`${colors.green}${colors.reset}`);
        });

        it('should handle special characters', () => {
            success('Test with special chars: !@#$%^&*()');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                `${colors.green}Test with special chars: !@#$%^&*()${colors.reset}`,
            );
        });
    });

    describe('error', () => {
        it('should output red message to stderr', () => {
            error('Test error');
            expect(consoleErrorSpy).toHaveBeenCalledWith(`${colors.red}Test error${colors.reset}`);
        });

        it('should handle empty string', () => {
            error('');
            expect(consoleErrorSpy).toHaveBeenCalledWith(`${colors.red}${colors.reset}`);
        });

        it('should handle special characters', () => {
            error('Error: Invalid input!');
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                `${colors.red}Error: Invalid input!${colors.reset}`,
            );
        });
    });

    describe('info', () => {
        it('should output cyan message', () => {
            info('Test info');
            expect(consoleLogSpy).toHaveBeenCalledWith(`${colors.cyan}Test info${colors.reset}`);
        });

        it('should handle empty string', () => {
            info('');
            expect(consoleLogSpy).toHaveBeenCalledWith(`${colors.cyan}${colors.reset}`);
        });
    });

    describe('warn', () => {
        it('should output yellow message', () => {
            warn('Test warning');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                `${colors.yellow}Test warning${colors.reset}`,
            );
        });

        it('should handle empty string', () => {
            warn('');
            expect(consoleLogSpy).toHaveBeenCalledWith(`${colors.yellow}${colors.reset}`);
        });
    });

    describe('header', () => {
        it('should output blue message with newline prefix', () => {
            header('Test Header');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                `\n${colors.blue}Test Header${colors.reset}`,
            );
        });

        it('should handle empty string', () => {
            header('');
            expect(consoleLogSpy).toHaveBeenCalledWith(`\n${colors.blue}${colors.reset}`);
        });
    });

    describe('section', () => {
        it('should output cyan message with newline prefix', () => {
            section('Test Section');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                `\n${colors.cyan}Test Section${colors.reset}`,
            );
        });

        it('should handle empty string', () => {
            section('');
            expect(consoleLogSpy).toHaveBeenCalledWith(`\n${colors.cyan}${colors.reset}`);
        });
    });

    describe('listItem', () => {
        it('should output list item with default bullet symbol', () => {
            listItem('Test item');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                `  ${colors.gray}•${colors.reset} Test item`,
            );
        });

        it('should output list item with custom symbol', () => {
            listItem('Test item', '✓');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                `  ${colors.gray}✓${colors.reset} Test item`,
            );
        });

        it('should handle empty string', () => {
            listItem('');
            expect(consoleLogSpy).toHaveBeenCalledWith(`  ${colors.gray}•${colors.reset} `);
        });

        it('should handle custom symbols correctly', () => {
            listItem('Success item', '✓');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                `  ${colors.gray}✓${colors.reset} Success item`,
            );

            listItem('Failed item', '✗');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                `  ${colors.gray}✗${colors.reset} Failed item`,
            );
        });
    });
});
