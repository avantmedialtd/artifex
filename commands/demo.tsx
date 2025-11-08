/**
 * Demo command showcasing full Ink component usage
 * This serves as a reference implementation for using Ink components
 */

import { Box, Text } from 'ink';
import { useEffect, useState } from 'react';
import { render } from '../utils/ink-render.tsx';
import { Spinner, ProgressBar } from '../components/progress.tsx';
import { Header, Section, ListItem } from '../components/layout.tsx';
import { Success, Error, Info, Warn } from '../components/messages.tsx';
import { StatusDisplay, StatusLine } from '../components/status-display.tsx';

/**
 * Demo component showing various Ink components
 * Demonstrates static messages, progress indicators, and live updates
 */
function DemoComponent() {
    const [progress, setProgress] = useState(0);
    const [statuses, setStatuses] = useState<StatusLine[]>([
        { id: '1', message: 'Installing dependencies...', status: 'running' },
        { id: '2', message: 'Running tests...', status: 'pending' },
        { id: '3', message: 'Building project...', status: 'pending' },
    ]);

    useEffect(() => {
        // Simulate progress updates
        const progressTimer = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(progressTimer);
                    return 100;
                }
                return prev + 5;
            });
        }, 200);

        // Simulate status updates
        const statusTimer = setTimeout(() => {
            setStatuses([
                { id: '1', message: 'Installing dependencies...', status: 'success' },
                { id: '2', message: 'Running tests...', status: 'running' },
                { id: '3', message: 'Building project...', status: 'pending' },
            ]);

            setTimeout(() => {
                setStatuses([
                    { id: '1', message: 'Installing dependencies...', status: 'success' },
                    { id: '2', message: 'Running tests...', status: 'success' },
                    { id: '3', message: 'Building project...', status: 'running' },
                ]);

                setTimeout(() => {
                    setStatuses([
                        { id: '1', message: 'Installing dependencies...', status: 'success' },
                        { id: '2', message: 'Running tests...', status: 'success' },
                        { id: '3', message: 'Building project...', status: 'success' },
                    ]);
                }, 1500);
            }, 1500);
        }, 1500);

        return () => {
            clearInterval(progressTimer);
            clearTimeout(statusTimer);
        };
    }, []);

    return (
        <Box flexDirection="column" padding={1}>
            {/* Header */}
            <Header>Ink Component Demo</Header>

            {/* Basic messages */}
            <Box flexDirection="column" marginTop={1}>
                <Section>Message Components</Section>
                <Success message="Operation completed successfully!" />
                <Error message="An error occurred during processing" />
                <Info message="This is an informational message" />
                <Warn message="Warning: This action cannot be undone" />
            </Box>

            {/* Layout components */}
            <Box flexDirection="column" marginTop={1}>
                <Section>Layout Components</Section>
                <ListItem>First list item</ListItem>
                <ListItem>Second list item</ListItem>
                <ListItem symbol="→">Custom symbol item</ListItem>
            </Box>

            {/* Progress indicators */}
            <Box flexDirection="column" marginTop={1}>
                <Section>Progress Indicators</Section>
                <Spinner label="Loading..." />
                <Box marginTop={1}>
                    <ProgressBar value={progress} label="Building project" width={30} />
                </Box>
            </Box>

            {/* Multi-status display */}
            <Box flexDirection="column" marginTop={1}>
                <Section>Status Tracking</Section>
                <StatusDisplay statuses={statuses} />
            </Box>

            <Box marginTop={1}>
                <Text color="gray">Press Ctrl+C to exit</Text>
            </Box>
        </Box>
    );
}

/**
 * Handle the 'demo' command
 * Displays a demo of all Ink components
 *
 * @returns Exit code (0 = success)
 */
export async function handleDemo(): Promise<number> {
    const { waitUntilExit } = render(<DemoComponent />);
    await waitUntilExit();
    return 0;
}
