import { Box, Text } from 'ink';

/**
 * Column definition for Table component
 */
export interface TableColumn<T> {
    /** Column header text */
    header: string;
    /** Key or accessor function to get the cell value */
    accessor: keyof T | ((row: T) => string | number);
    /** Optional width (auto-calculated if not provided) */
    width?: number;
}

/**
 * Props for Table component
 */
export interface TableProps<T> {
    /** Array of data rows */
    data: T[];
    /** Column definitions */
    columns: TableColumn<T>[];
}

/**
 * Table component with flexible column layout
 * Uses Flexbox for column layout with automatic width calculation
 */
export function Table<T>({ data, columns }: TableProps<T>) {
    // Helper function to get cell value
    const getCellValue = (row: T, column: TableColumn<T>): string => {
        if (typeof column.accessor === 'function') {
            return String(column.accessor(row));
        }
        return String(row[column.accessor]);
    };

    // Calculate column widths based on content if not specified
    const columnWidths = columns.map(column => {
        if (column.width) {
            return column.width;
        }

        // Calculate based on header and data content
        const headerLength = column.header.length;
        const maxDataLength = Math.max(...data.map(row => getCellValue(row, column).length), 0);

        return Math.max(headerLength, maxDataLength);
    });

    return (
        <Box flexDirection="column">
            {/* Header row */}
            <Box>
                {columns.map((column, index) => (
                    <Box key={column.header} width={columnWidths[index] + 2}>
                        <Text bold color="cyan">
                            {column.header.padEnd(columnWidths[index])}
                        </Text>
                    </Box>
                ))}
            </Box>

            {/* Data rows */}
            {data.map((row, rowIndex) => (
                <Box key={rowIndex}>
                    {columns.map((column, colIndex) => {
                        const cellValue = getCellValue(row, column);
                        return (
                            <Box key={colIndex} width={columnWidths[colIndex] + 2}>
                                <Text>{cellValue.padEnd(columnWidths[colIndex])}</Text>
                            </Box>
                        );
                    })}
                </Box>
            ))}
        </Box>
    );
}
