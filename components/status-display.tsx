import { Box, Text } from 'ink';

/**
 * Status type for display
 */
export type StatusType = 'pending' | 'running' | 'success' | 'error';

/**
 * Single status line item
 */
export interface StatusLine {
    id: string;
    message: string;
    status: StatusType;
}

/**
 * Props for StatusDisplay component
 */
export interface StatusDisplayProps {
    /** Array of status lines to display */
    statuses: StatusLine[];
}

/**
 * Get the appropriate icon for a status type
 */
function getStatusIcon(status: StatusType): string {
    switch (status) {
        case 'pending':
            return '○';
        case 'running':
            return '⟳';
        case 'success':
            return '✓';
        case 'error':
            return '✗';
    }
}

/**
 * Get the appropriate color for a status type
 */
function getStatusColor(status: StatusType): string {
    switch (status) {
        case 'pending':
            return 'gray';
        case 'running':
            return 'cyan';
        case 'success':
            return 'green';
        case 'error':
            return 'red';
    }
}

/**
 * StatusDisplay component for tracking multiple operations
 * Displays multiple status lines that can be independently updated
 */
export function StatusDisplay({ statuses }: StatusDisplayProps) {
    return (
        <Box flexDirection="column">
            {statuses.map(statusLine => (
                <Box key={statusLine.id}>
                    <Text color={getStatusColor(statusLine.status)}>
                        {getStatusIcon(statusLine.status)}
                    </Text>
                    <Text> {statusLine.message}</Text>
                </Box>
            ))}
        </Box>
    );
}
