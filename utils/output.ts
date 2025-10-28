/**
 * Terminal output utilities with ANSI color codes for consistent CLI formatting.
 * Uses built-in ANSI escape codes without external dependencies.
 */

/**
 * ANSI color codes for terminal output.
 * These codes work in most modern terminals and degrade gracefully when colors aren't supported.
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
    console.log(`${colors.green}${message}${colors.reset}`);
}

/**
 * Display an error message in red.
 * @param message - The error message to display
 */
export function error(message: string): void {
    console.error(`${colors.red}${message}${colors.reset}`);
}

/**
 * Display an informational message in cyan.
 * @param message - The info message to display
 */
export function info(message: string): void {
    console.log(`${colors.cyan}${message}${colors.reset}`);
}

/**
 * Display a warning message in yellow.
 * @param message - The warning message to display
 */
export function warn(message: string): void {
    console.log(`${colors.yellow}${message}${colors.reset}`);
}

/**
 * Display a header message in blue with emphasis.
 * Useful for section titles or major status updates.
 * @param message - The header text to display
 */
export function header(message: string): void {
    console.log(`\n${colors.blue}${message}${colors.reset}`);
}

/**
 * Display a section message in bold (using color for emphasis).
 * Useful for sub-sections or grouped content.
 * @param message - The section text to display
 */
export function section(message: string): void {
    console.log(`\n${colors.cyan}${message}${colors.reset}`);
}

/**
 * Display a list item with an optional symbol prefix.
 * @param message - The list item text to display
 * @param symbol - Optional symbol to prefix (default: '•')
 */
export function listItem(message: string, symbol: string = '•'): void {
    console.log(`  ${colors.gray}${symbol}${colors.reset} ${message}`);
}
