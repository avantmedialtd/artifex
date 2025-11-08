import { Box, Text, useInput } from 'ink';
import { useState } from 'react';

/**
 * Props for TextInput component
 */
export interface TextInputProps {
    /** Placeholder text to display when input is empty */
    placeholder?: string;
    /** Initial value of the input */
    value?: string;
    /** Callback when input value changes */
    onChange?: (value: string) => void;
    /** Callback when user presses Enter */
    onSubmit?: (value: string) => void;
}

/**
 * TextInput component for user text input
 * Provides controlled text input with keyboard handling
 */
export function TextInput({
    placeholder = '',
    value: initialValue = '',
    onChange,
    onSubmit,
}: TextInputProps) {
    const [value, setValue] = useState(initialValue);

    useInput((input, key) => {
        if (key.return) {
            // Enter key pressed
            onSubmit?.(value);
        } else if (key.backspace || key.delete) {
            // Backspace/Delete key pressed
            const newValue = value.slice(0, -1);
            setValue(newValue);
            onChange?.(newValue);
        } else if (!key.ctrl && !key.meta && !key.escape) {
            // Regular character input
            const newValue = value + input;
            setValue(newValue);
            onChange?.(newValue);
        }
    });

    return (
        <Box>
            <Text>{value || <Text color="gray">{placeholder}</Text>}</Text>
            <Text color="cyan">█</Text>
        </Box>
    );
}
