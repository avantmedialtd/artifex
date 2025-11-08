import { render as inkRender } from 'ink';
import type { ReactElement } from 'react';

/**
 * Render an Ink component to the terminal with signal handling
 * @param element The React element to render
 * @returns Object with cleanup function and promise that resolves when component unmounts
 */
export function render(element: ReactElement) {
    const { unmount, waitUntilExit, clear } = inkRender(element);

    // Handle graceful shutdown on SIGINT (Ctrl+C)
    const handleSigInt = () => {
        unmount();
        process.exit(0);
    };

    // Handle graceful shutdown on SIGTERM
    const handleSigTerm = () => {
        unmount();
        process.exit(0);
    };

    process.on('SIGINT', handleSigInt);
    process.on('SIGTERM', handleSigTerm);

    // Clean up signal handlers when component unmounts
    const cleanup = () => {
        process.off('SIGINT', handleSigInt);
        process.off('SIGTERM', handleSigTerm);
        unmount();
    };

    return {
        unmount,
        cleanup,
        waitUntilExit,
        clear,
    };
}

/**
 * Render an Ink component synchronously and wait for it to finish
 * Useful for fire-and-forget static content
 * @param element The React element to render
 */
export function renderSync(element: ReactElement): void {
    const { waitUntilExit } = render(element);
    waitUntilExit();
}
