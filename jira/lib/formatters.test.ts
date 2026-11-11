import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    formatAttachmentList,
    formatAttachmentTable,
    formatAttachments,
    formatFields,
    formatIssue,
    formatIssueList,
    formatWorklogs,
} from './formatters.ts';
import type { CustomFieldDef } from './fields/codec-types.ts';
import type {
    JiraAdfDocument,
    JiraAdfNode,
    JiraAttachment,
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

describe('attachments', () => {
    // Without a base URL, issue keys print as plain text rather than as links.
    beforeEach(() => {
        vi.stubEnv('ATLASSIAN_BASE_URL', '');
        vi.stubEnv('JIRA_BASE_URL', '');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    const author = { accountId: 'a1', displayName: 'Jane Doe', active: true };
    const attachment = (id: string, filename: string, size: number): JiraAttachment => ({
        id,
        filename,
        size,
        mimeType: 'image/png',
        content: `https://test.atlassian.net/rest/api/3/attachment/content/${id}`,
        created: '2026-01-02T09:00:00.000+0000',
        author,
    });
    const mobileModules = attachment('10113', 'mobile-modules.png', 38_612);

    function row(table: string, id: string): string {
        const found = table.split('\n').find(line => line.startsWith(`| ${id} |`));
        if (found === undefined) throw new Error(`no row for ${id} in:\n${table}`);
        return found;
    }

    describe('formatAttachmentTable', () => {
        it('shows the ID, filename, size, type, date added and author', () => {
            const table = formatAttachmentTable([mobileModules]);
            expect(table.split('\n').slice(0, 2)).toEqual([
                '| ID | Filename | Size | Type | Added |',
                '|----|----------|------|------|-------|',
            ]);
            expect(row(table, '10113')).toContain(
                '10113 | mobile-modules.png | 37.7 KB | image/png',
            );
            expect(row(table, '10113')).toMatch(/ by Jane Doe \|$/);
        });

        it('escapes a pipe in a filename', () => {
            const table = formatAttachmentTable([attachment('1', 'a|b.txt', 10)]);
            expect(row(table, '1')).toContain('| a\\|b.txt |');
        });

        it('shows control characters as _', () => {
            const bell = String.fromCharCode(7);
            const table = formatAttachmentTable([attachment('1', `bad\nname${bell}.txt`, 10)]);
            expect(table.split('\n')).toHaveLength(3);
            expect(row(table, '1')).toContain('| bad_name_.txt |');
        });

        it('leaves out the author when the attachment has none', () => {
            const anonymous = { ...mobileModules, author: undefined } as unknown as JiraAttachment;
            expect(row(formatAttachmentTable([anonymous]), '10113')).not.toContain(' by ');
        });
    });

    describe('formatAttachmentList', () => {
        it('heads the table with the issue key and the count', () => {
            const out = formatAttachmentList('MR-10', [
                mobileModules,
                attachment('10115', 'mobile-property-settings.png', 38_750),
            ]);
            expect(out.split('\n')[0]).toBe('# Attachments on MR-10 (2)');
            expect(out).toContain('| 10115 | mobile-property-settings.png | 37.8 KB |');
        });

        it('says when there are none', () => {
            expect(formatAttachmentList('PROJ-1', [])).toBe(
                '# Attachments on PROJ-1 (0)\n\nNo attachments.',
            );
        });
    });

    describe('formatIssue', () => {
        const def: CustomFieldDef = {
            id: 'customfield_10016',
            name: 'Story Points',
            schemaType: 'number',
        };
        const remoteLinks = [{ id: 1, object: { url: 'https://example.com/doc', title: 'Doc' } }];

        it('puts the Attachments section between Remote Links and Custom Fields', () => {
            const issue = sampleIssue({
                attachment: [attachment('10046', 'image-20251217-080021.png', 26_904)],
                customfield_10016: 5,
            });
            const out = formatIssue(issue, remoteLinks, [def]);

            const remote = out.indexOf('## Remote Links');
            const attachments = out.indexOf('## Attachments (1)');
            const custom = out.indexOf('## Custom Fields');
            expect(remote).toBeGreaterThan(-1);
            expect(attachments).toBeGreaterThan(remote);
            expect(custom).toBeGreaterThan(attachments);
            expect(out).toContain('| 10046 | image-20251217-080021.png | 26.3 KB | image/png |');
        });

        it('follows the table with a hint naming the issue key', () => {
            const out = formatIssue(sampleIssue({ attachment: [mobileModules] }));
            const lines = out.split('\n');
            const hint = lines.findIndex(line => line.startsWith('Download: '));
            expect(lines[hint]).toContain('`af jira download PROJ-1`');
            expect(lines[hint - 1]).toBe('');
            expect(lines[hint - 2]).toContain('| 10113 |');
        });

        it('has no Attachments section without attachments', () => {
            expect(formatIssue(sampleIssue())).not.toContain('## Attachments');
            expect(formatIssue(sampleIssue({ attachment: [] }))).not.toContain('## Attachments');
            expect(formatIssue(sampleIssue())).not.toContain('af jira download');
        });
    });

    describe('formatAttachments (the upload result)', () => {
        it('prints the same table as before', () => {
            const uploaded = [
                { ...attachment('1', 'notes.txt', 512), mimeType: 'text/plain' },
                mobileModules,
                { ...attachment('3', 'demo.mp4', 5_452_595), mimeType: 'video/mp4' },
            ];
            expect(formatAttachments('PROJ-1', uploaded)).toBe(
                [
                    '# Attachments added to PROJ-1',
                    '',
                    '| Filename | Size | Type |',
                    '|----------|------|------|',
                    '| notes.txt | 512 B | text/plain |',
                    '| mobile-modules.png | 37.7 KB | image/png |',
                    '| demo.mp4 | 5.2 MB | video/mp4 |',
                ].join('\n'),
            );
        });
    });
});
