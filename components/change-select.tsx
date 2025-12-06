import { Box, Text, useApp, useInput } from 'ink';
import React, { useState } from 'react';
import type { OngoingChange } from '../utils/openspec.ts';

/**
 * Props for ChangeSelect component
 */
export interface ChangeSelectProps {
    /** Array of ongoing changes to choose from */
    changes: OngoingChange[];
    /** Callback when a change is selected */
    onSelect: (changeId: string) => void;
    /** Callback when selection is cancelled */
    onCancel: () => void;
    /** Custom prompt text to display (default: "Select a change:") */
    prompt?: string;
}

/**
 * Interactive change selection component for commands that need to select from ongoing changes.
 * Allows users to select from multiple ongoing changes using keyboard navigation.
 */
export function ChangeSelect({
    changes,
    onSelect,
    onCancel,
    prompt = 'Select a change:',
}: ChangeSelectProps) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const { exit } = useApp();

    useInput((input, key) => {
        if (key.upArrow) {
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : changes.length - 1));
        } else if (key.downArrow) {
            setSelectedIndex(prev => (prev < changes.length - 1 ? prev + 1 : 0));
        } else if (key.return) {
            const selectedChange = changes[selectedIndex];
            onSelect(selectedChange.id);
        } else if (key.escape || (key.ctrl && input === 'c')) {
            onCancel();
            exit();
        }
    });

    return (
        <Box flexDirection="column">
            <Box marginBottom={1}>
                <Text bold color="cyan">
                    {prompt}
                </Text>
            </Box>
            {changes.map((change, index) => {
                const isHighlighted = index === selectedIndex;
                const indicator = isHighlighted ? '›' : ' ';

                return (
                    <Box key={change.id}>
                        <Text color={isHighlighted ? 'cyan' : undefined}>
                            {indicator} {change.id}
                        </Text>
                        <Text color="gray"> ({change.status})</Text>
                    </Box>
                );
            })}
            <Box marginTop={1}>
                <Text color="gray">↑/↓ to navigate, Enter to select, Esc to cancel</Text>
            </Box>
        </Box>
    );
}
