import { Box, Text } from 'ink';
import { useEffect, useState } from 'react';

/**
 * Props for Spinner component
 */
export interface SpinnerProps {
    label?: string;
}

/**
 * Spinner component with rotating animation
 * Displays an animated spinner with optional label
 */
export function Spinner({ label }: SpinnerProps) {
    const [frame, setFrame] = useState(0);
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

    useEffect(() => {
        const timer = setInterval(() => {
            setFrame(prevFrame => (prevFrame + 1) % frames.length);
        }, 80);

        return () => clearInterval(timer);
    }, [frames.length]);

    return (
        <Box>
            <Text color="cyan">{frames[frame]}</Text>
            {label && <Text> {label}</Text>}
        </Box>
    );
}

/**
 * Props for ProgressBar component
 */
export interface ProgressBarProps {
    /** Current progress value (0-100) */
    value: number;
    /** Width of the progress bar in characters (default: 40) */
    width?: number;
    /** Optional label to display */
    label?: string;
    /** Show percentage (default: true) */
    showPercentage?: boolean;
}

/**
 * ProgressBar component with visual bar display
 * Displays a progress bar with percentage and optional label
 */
export function ProgressBar({ value, width = 40, label, showPercentage = true }: ProgressBarProps) {
    const percentage = Math.min(100, Math.max(0, value));
    const filledWidth = Math.round((percentage / 100) * width);
    const emptyWidth = width - filledWidth;

    const filledBar = '█'.repeat(filledWidth);
    const emptyBar = '░'.repeat(emptyWidth);

    return (
        <Box flexDirection="column">
            {label && <Text>{label}</Text>}
            <Box>
                <Text color="green">{filledBar}</Text>
                <Text color="gray">{emptyBar}</Text>
                {showPercentage && <Text> {percentage.toFixed(0)}%</Text>}
            </Box>
        </Box>
    );
}
