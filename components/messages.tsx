import { createElement } from 'react';
import { Text } from 'ink';

/**
 * Props for message components
 */
export interface MessageProps {
    message: string;
    children?: never;
}

/**
 * Success message component (green)
 * Displays a success message in green text
 */
export function Success({ message }: MessageProps) {
    return <Text color="green">{message}</Text>;
}

/**
 * Error message component (red)
 * Displays an error message in red text
 */
export function Error({ message }: MessageProps) {
    return <Text color="red">{message}</Text>;
}

/**
 * Info message component (cyan)
 * Displays an informational message in cyan text
 */
export function Info({ message }: MessageProps) {
    return <Text color="cyan">{message}</Text>;
}

/**
 * Warning message component (yellow)
 * Displays a warning message in yellow text
 */
export function Warn({ message }: MessageProps) {
    return <Text color="yellow">{message}</Text>;
}

// Helper functions to create elements without JSX (for use in .ts files)
export const createSuccess = (message: string) => createElement(Success, { message });
export const createError = (message: string) => createElement(Error, { message });
export const createInfo = (message: string) => createElement(Info, { message });
export const createWarn = (message: string) => createElement(Warn, { message });
