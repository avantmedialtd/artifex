import { Box, Text, useInput } from 'ink';
import { useState } from 'react';

/**
 * Option for Select component
 */
export interface SelectOption {
    label: string;
    value: string;
}

/**
 * Props for Select component
 */
export interface SelectProps {
    /** Array of options to choose from */
    options: SelectOption[];
    /** Callback when an option is selected */
    onSelect?: (value: string) => void;
    /** Enable multi-select mode (default: false) */
    multiSelect?: boolean;
    /** Callback for multi-select completion */
    onSubmit?: (values: string[]) => void;
}

/**
 * Select component with keyboard navigation
 * Provides option selection with up/down arrow keys and Enter to confirm
 */
export function Select({ options, onSelect, multiSelect = false, onSubmit }: SelectProps) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [selectedValues, setSelectedValues] = useState<Set<string>>(new Set());

    useInput((input, key) => {
        if (key.upArrow) {
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
        } else if (key.downArrow) {
            setSelectedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
        } else if (key.return) {
            const selectedOption = options[selectedIndex];
            if (multiSelect) {
                // Toggle selection in multi-select mode
                setSelectedValues(prev => {
                    const next = new Set(prev);
                    if (next.has(selectedOption.value)) {
                        next.delete(selectedOption.value);
                    } else {
                        next.add(selectedOption.value);
                    }
                    return next;
                });
            } else {
                // Single select mode
                onSelect?.(selectedOption.value);
            }
        } else if (input === ' ' && multiSelect) {
            // Space bar submits in multi-select mode
            onSubmit?.(Array.from(selectedValues));
        }
    });

    return (
        <Box flexDirection="column">
            {options.map((option, index) => {
                const isHighlighted = index === selectedIndex;
                const isSelected = selectedValues.has(option.value);
                const indicator = multiSelect
                    ? isSelected
                        ? '[✓]'
                        : '[ ]'
                    : isHighlighted
                      ? '›'
                      : ' ';

                return (
                    <Box key={option.value}>
                        <Text color={isHighlighted ? 'cyan' : undefined}>
                            {indicator} {option.label}
                        </Text>
                    </Box>
                );
            })}
            {multiSelect && (
                <Box marginTop={1}>
                    <Text color="gray">Press Enter to toggle, Space to submit</Text>
                </Box>
            )}
        </Box>
    );
}
