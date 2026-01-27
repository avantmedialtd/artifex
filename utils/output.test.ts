import chalk from 'chalk';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { colors, error, header, info, link, listItem, section, success, warn } from './output.ts';

describe('output utilities', () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeAll(() => {
        // Force chalk to output colors in tests
        chalk.level = 1; // Basic color support
    });

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
            expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green('Test success'));
        });

        it('should handle empty string', () => {
            success('');
            expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green(''));
        });

        it('should handle special characters', () => {
            success('Test with special chars: !@#$%^&*()');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                chalk.green('Test with special chars: !@#$%^&*()'),
            );
        });
    });

    describe('error', () => {
        it('should output red message to stderr', () => {
            error('Test error');
            expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red('Test error'));
        });

        it('should handle empty string', () => {
            error('');
            expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red(''));
        });

        it('should handle special characters', () => {
            error('Error: Invalid input!');
            expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red('Error: Invalid input!'));
        });
    });

    describe('info', () => {
        it('should output cyan message', () => {
            info('Test info');
            expect(consoleLogSpy).toHaveBeenCalledWith(chalk.cyan('Test info'));
        });

        it('should handle empty string', () => {
            info('');
            expect(consoleLogSpy).toHaveBeenCalledWith(chalk.cyan(''));
        });
    });

    describe('warn', () => {
        it('should output yellow message', () => {
            warn('Test warning');
            expect(consoleLogSpy).toHaveBeenCalledWith(chalk.yellow('Test warning'));
        });

        it('should handle empty string', () => {
            warn('');
            expect(consoleLogSpy).toHaveBeenCalledWith(chalk.yellow(''));
        });
    });

    describe('header', () => {
        it('should output blue message with newline prefix', () => {
            header('Test Header');
            expect(consoleLogSpy).toHaveBeenCalledTimes(2);
            expect(consoleLogSpy).toHaveBeenNthCalledWith(1);
            expect(consoleLogSpy).toHaveBeenNthCalledWith(2, chalk.blue('Test Header'));
        });

        it('should handle empty string', () => {
            header('');
            expect(consoleLogSpy).toHaveBeenCalledTimes(2);
            expect(consoleLogSpy).toHaveBeenNthCalledWith(1);
            expect(consoleLogSpy).toHaveBeenNthCalledWith(2, chalk.blue(''));
        });
    });

    describe('section', () => {
        it('should output cyan message with newline prefix', () => {
            section('Test Section');
            expect(consoleLogSpy).toHaveBeenCalledTimes(2);
            expect(consoleLogSpy).toHaveBeenNthCalledWith(1);
            expect(consoleLogSpy).toHaveBeenNthCalledWith(2, chalk.cyan('Test Section'));
        });

        it('should handle empty string', () => {
            section('');
            expect(consoleLogSpy).toHaveBeenCalledTimes(2);
            expect(consoleLogSpy).toHaveBeenNthCalledWith(1);
            expect(consoleLogSpy).toHaveBeenNthCalledWith(2, chalk.cyan(''));
        });
    });

    describe('listItem', () => {
        it('should output list item with default bullet symbol', () => {
            listItem('Test item');
            expect(consoleLogSpy).toHaveBeenCalledWith(`  ${chalk.gray('•')} Test item`);
        });

        it('should output list item with custom symbol', () => {
            listItem('Test item', '✓');
            expect(consoleLogSpy).toHaveBeenCalledWith(`  ${chalk.gray('✓')} Test item`);
        });

        it('should handle empty string', () => {
            listItem('');
            expect(consoleLogSpy).toHaveBeenCalledWith(`  ${chalk.gray('•')} `);
        });

        it('should handle custom symbols correctly', () => {
            listItem('Success item', '✓');
            expect(consoleLogSpy).toHaveBeenCalledWith(`  ${chalk.gray('✓')} Success item`);

            listItem('Failed item', '✗');
            expect(consoleLogSpy).toHaveBeenCalledWith(`  ${chalk.gray('✗')} Failed item`);
        });
    });

    describe('link', () => {
        it('should create OSC 8 hyperlink with correct escape sequences', () => {
            const result = link('Click here', 'https://example.com');
            expect(result).toBe('\x1b]8;;https://example.com\x07Click here\x1b]8;;\x07');
        });

        it('should handle empty text', () => {
            const result = link('', 'https://example.com');
            expect(result).toBe('\x1b]8;;https://example.com\x07\x1b]8;;\x07');
        });

        it('should handle complex URLs', () => {
            const url = 'https://jira.example.com/browse/PROJ-123?param=value';
            const result = link('PROJ-123', url);
            expect(result).toBe(`\x1b]8;;${url}\x07PROJ-123\x1b]8;;\x07`);
        });

        it('should handle special characters in text', () => {
            const result = link('Issue: PROJ-123 (Critical)', 'https://example.com');
            expect(result).toBe(
                '\x1b]8;;https://example.com\x07Issue: PROJ-123 (Critical)\x1b]8;;\x07',
            );
        });

        it('should return a string that can be concatenated', () => {
            const linkedText = link('PROJ-123', 'https://example.com');
            const fullMessage = `Created issue ${linkedText}`;
            expect(fullMessage).toContain('Created issue');
            expect(fullMessage).toContain('PROJ-123');
            expect(fullMessage).toContain('\x1b]8;;');
        });
    });
});
