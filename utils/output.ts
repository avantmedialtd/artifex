/**
 * Terminal output utilities with Ink-based components for consistent CLI formatting.
 * Provides backward-compatible wrapper functions that use chalk (from Ink's dependency).
 *
 * For interactive UI, import and use Ink components directly via render().
 * These functions are optimized for static, one-off messages.
 */

import chalk from 'chalk';

/**
 * ANSI color codes for terminal output.
 * Kept for backward compatibility but deprecated in favor of chalk.
 * @deprecated Use chalk directly or Ink components for better control
 */
export const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
};

/**
 * Display a success message in green.
 * @param message - The success message to display
 */
export function success(message: string): void {
    console.log(chalk.green(message));
}

/**
 * Display an error message in red.
 * @param message - The error message to display
 */
export function error(message: string): void {
    console.error(chalk.red(message));
}

/**
 * Display an informational message in cyan.
 * @param message - The info message to display
 */
export function info(message: string): void {
    console.log(chalk.cyan(message));
}

/**
 * Display a warning message in yellow.
 * @param message - The warning message to display
 */
export function warn(message: string): void {
    console.log(chalk.yellow(message));
}

/**
 * Display a header message in blue with emphasis.
 * Useful for section titles or major status updates.
 * @param message - The header text to display
 */
export function header(message: string): void {
    console.log();
    console.log(chalk.blue(message));
}

/**
 * Display a section message in bold (using color for emphasis).
 * Useful for sub-sections or grouped content.
 * @param message - The section text to display
 */
export function section(message: string): void {
    console.log();
    console.log(chalk.cyan(message));
}

/**
 * Display a list item with an optional symbol prefix.
 * @param message - The list item text to display
 * @param symbol - Optional symbol to prefix (default: '•')
 */
export function listItem(message: string, symbol: string = '•'): void {
    console.log(`  ${chalk.gray(symbol)} ${message}`);
}
