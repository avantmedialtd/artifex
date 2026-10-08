import { describe, it, expect } from 'vitest';
import { formatFields, formatIssue, formatIssueList, formatWorklogs } from './formatters.ts';
import type { CustomFieldDef } from './fields/codec-types.ts';
import type {
    JiraAdfDocument,
    JiraAdfNode,
    JiraIssue,
    JiraSearchResult,
    JiraWorklog,
} from './types.ts';

const sampleStatus = {
    id: '1',
    name: 'In Progress',
    statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress' },
};

function sampleIssue(extra: Record<string, unknown> = {}): JiraIssue {
    return {
        id: '1',
        key: 'PROJ-1',
        self: '',
        fields: {
            summary: 'Something',
            status: sampleStatus,
            issuetype: { id: '10001', name: 'Story', subtask: false },
            project: { id: '1', key: 'PROJ', name: 'Project', projectTypeKey: 'software' },
            created: '2026-01-01T00:00:00.000Z',
            updated: '2026-01-02T00:00:00.000Z',
            ...extra,
        },
    };
}

describe('formatFields', () => {
    it('renders an unscoped table', () => {
        const defs: CustomFieldDef[] = [
            { id: 'customfield_10016', name: 'Story Points', schemaType: 'number' },
        ];
        const out = formatFields(defs);
        expect(out).toContain('| Alias | ID | Name | Type |');
        expect(out).toContain('| customfield_10016 | Story Points | number |');
    });

    it('renders a scoped table with required and allowed-values columns', () => {
        const defs: CustomFieldDef[] = [
            {
                id: 'customfield_10099',
                name: 'Severity',
                schemaType: 'option',
                required: true,
                allowedValues: ['Low', 'High'],
                alias: 'severity',
            },
        ];
        const out = formatFields(defs, { scoped: true });
        expect(out).toContain('Required');
        expect(out).toContain('Allowed Values');
        expect(out).toContain(
            '| severity | customfield_10099 | Severity | option | ✓ | Low, High |',
        );
    });
});

describe('formatIssue with custom fields', () => {
    const def: CustomFieldDef = {
        id: 'customfield_10016',
        name: 'Story Points',
        schemaType: 'number',
    };

    it('renders a Custom Fields section when values present', () => {
        const issue = sampleIssue({ customfield_10016: 5 });
        const out = formatIssue(issue, undefined, [def]);
        expect(out).toContain('## Custom Fields');
        expect(out).toContain('| Story Points | 5 |');
    });

    it('omits the section when no non-null custom fields', () => {
        const issue = sampleIssue({ customfield_10016: null });
        const out = formatIssue(issue, undefined, [def]);
        expect(out).not.toContain('## Custom Fields');
    });

    it('uses alias when configured', () => {
        const issue = sampleIssue({ customfield_10016: 5 });
        const out = formatIssue(issue, undefined, [{ ...def, alias: 'storyPoints' }]);
        expect(out).toContain('| storyPoints | 5 |');
    });
});

describe('formatIssueList with --show-field columns', () => {
    const def: CustomFieldDef = {
        id: 'customfield_10016',
        name: 'Story Points',
        schemaType: 'number',
    };

    it('appends a column per configured field', () => {
        const result: JiraSearchResult = {
            total: 1,
            issues: [sampleIssue({ customfield_10016: 8 })],
        };
        const out = formatIssueList(result, [def]);
        expect(out).toContain('Story Points');
        expect(out).toContain(' 8 |');
    });

    it('leaves table unchanged with no extras', () => {
        const result: JiraSearchResult = { total: 1, issues: [sampleIssue()] };
        const out = formatIssueList(result);
        expect(out).not.toContain('Story Points');
    });
});

describe('formatWorklogs', () => {
    const worklog = (comment: JiraWorklog['comment']): JiraWorklog => ({
        id: '10001',
        author: { accountId: 'a1', displayName: 'Jane Doe', active: true },
        timeSpent: '1h',
        started: '2026-01-02T09:00:00.000+0000',
        comment,
    });
    const paragraph = (text: string): JiraAdfNode => ({
        type: 'paragraph',
        content: [{ type: 'text', text }],
    });
    const adf = (...content: JiraAdfNode[]): JiraAdfDocument => ({
        type: 'doc',
        version: 1,
        content,
    });

    // The cells of a markdown table row, split as GFM splits them: a pipe after an
    // odd number of backslashes is escaped and does not end a cell.
    function cells(row: string): string[] {
        const found: string[] = [];
        let cell = '';
        let backslashes = 0;
        for (const char of row) {
            if (char === '|' && backslashes % 2 === 0) {
                found.push(cell);
                cell = '';
            } else {
                cell += char;
            }
            backslashes = char === '\\' ? backslashes + 1 : 0;
        }
        // Drop what lies outside the leading and trailing pipes.
        return found.slice(1);
    }

    function worklogRow(comment: JiraWorklog['comment']): string {
        const out = formatWorklogs('PROJ-1', [worklog(comment)]);
        const row = out.split('\n').find(line => line.startsWith('| 10001 |'));
        if (row === undefined) throw new Error(`no worklog row in:\n${out}`);
        return row;
    }

    it('escapes a pipe in a comment, so the row keeps its five cells', () => {
        const row = worklogRow(adf(paragraph('a | b')));
        expect(cells(row)).toHaveLength(5);
        expect(cells(row)[4].trim()).toBe('a \\| b');
    });

    it('keeps five cells for a comment holding a table', () => {
        const header = (text: string): JiraAdfNode => ({
            type: 'tableHeader',
            content: [paragraph(text)],
        });
        const cell = (text: string): JiraAdfNode => ({
            type: 'tableCell',
            content: [paragraph(text)],
        });
        const row = worklogRow(
            adf({
                type: 'table',
                content: [
                    { type: 'tableRow', content: [header('Suite'), header('Result')] },
                    { type: 'tableRow', content: [cell('a | b'), cell('pass')] },
                ],
            }),
        );
        expect(cells(row)).toHaveLength(5);
    });

    it('leaves a pipe that a backslash already escapes as it is', () => {
        // adfToText writes the pipes inside its table cells as `\|`.
        const row = worklogRow('a \\| b and c \\\\| d');
        expect(cells(row)).toHaveLength(5);
        expect(cells(row)[4].trim()).toBe('a \\| b and c \\\\\\| d');
    });

    it('escapes after truncating the comment to 40 characters', () => {
        const row = worklogRow(`${'x'.repeat(39)}|y`);
        expect(cells(row)[4].trim()).toBe(`${'x'.repeat(39)}\\|`);
    });
});
