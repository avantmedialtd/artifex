import { Box, Text, useInput } from 'ink';
import type { ConflictResolution } from '../utils/setup-files.ts';

/**
 * Props for FileConflict component
 */
export interface FileConflictProps {
    /** The file path that has a conflict */
    filePath: string;
    /** Callback when user makes a resolution choice */
    onResolve: (resolution: ConflictResolution) => void;
}

/**
 * Interactive component for resolving file conflicts during setup.
 * Displays the conflicting file path and accepts keyboard input:
 * - y: Overwrite this file
 * - n: Skip this file
 * - a: Overwrite all remaining files
 * - s: Skip all remaining files
 */
export function FileConflict({ filePath, onResolve }: FileConflictProps) {
    useInput(input => {
        const key = input.toLowerCase();
        switch (key) {
            case 'y':
                onResolve('overwrite');
                break;
            case 'n':
                onResolve('skip');
                break;
            case 'a':
                onResolve('overwrite-all');
                break;
            case 's':
                onResolve('skip-all');
                break;
        }
    });

    return (
        <Box flexDirection="column">
            <Box>
                <Text color="yellow">File exists: </Text>
                <Text>{filePath}</Text>
            </Box>
            <Box marginTop={1}>
                <Text color="gray">[y] Overwrite [n] Skip [a] Overwrite all [s] Skip all</Text>
            </Box>
        </Box>
    );
}
