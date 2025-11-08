import { createElement } from 'react';
import { Box, Text } from 'ink';

/**
 * Props for Header component
 */
export interface HeaderProps {
    children: string;
}

/**
 * Header component (blue with newline before)
 * Displays a section header in blue text with spacing
 */
export function Header({ children }: HeaderProps) {
    return (
        <Box flexDirection="column">
            <Text>{''}</Text>
            <Text color="blue">{children}</Text>
        </Box>
    );
}

/**
 * Props for Section component
 */
export interface SectionProps {
    children: string;
}

/**
 * Section component (cyan with newline before)
 * Displays a sub-section header in cyan text with spacing
 */
export function Section({ children }: SectionProps) {
    return (
        <Box flexDirection="column">
            <Text>{''}</Text>
            <Text color="cyan">{children}</Text>
        </Box>
    );
}

/**
 * Props for ListItem component
 */
export interface ListItemProps {
    children: string;
    symbol?: string;
}

/**
 * ListItem component (gray symbol with indentation)
 * Displays a list item with a symbol prefix and indentation
 */
export function ListItem({ children, symbol = '•' }: ListItemProps) {
    return (
        <Box>
            <Text> </Text>
            <Text color="gray">{symbol}</Text>
            <Text> {children}</Text>
        </Box>
    );
}

// Helper functions to create elements without JSX (for use in .ts files)
export const createHeader = (children: string) => createElement(Header, { children });
export const createSection = (children: string) => createElement(Section, { children });
export const createListItem = (children: string, symbol?: string) =>
    createElement(ListItem, { children, symbol });
