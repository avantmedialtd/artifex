import { Box, Text, useInput } from 'ink';

/**
 * Props for Confirm component
 */
export interface ConfirmProps {
    /** The question to ask the user */
    message: string;
    /** Default value (default: false) */
    defaultValue?: boolean;
    /** Callback when user confirms (true) or denies (false) */
    onConfirm?: (confirmed: boolean) => void;
}

/**
 * Confirm component for yes/no prompts
 * Accepts y/n or yes/no input
 */
export function Confirm({ message, defaultValue = false, onConfirm }: ConfirmProps) {
    useInput(input => {
        const normalized = input.toLowerCase();

        if (normalized === 'y' || normalized === 'yes') {
            onConfirm?.(true);
        } else if (normalized === 'n' || normalized === 'no') {
            onConfirm?.(false);
        } else if (input === '') {
            // Enter with no input uses default
            onConfirm?.(defaultValue);
        }
    });

    const hint = defaultValue ? '(Y/n)' : '(y/N)';

    return (
        <Box>
            <Text>{message} </Text>
            <Text color="gray">{hint}</Text>
        </Box>
    );
}
