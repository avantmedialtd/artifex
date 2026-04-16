import { describe, it, expect } from 'vitest';
import { formatFields, formatIssue, formatIssueList } from './formatters.ts';
import type { CustomFieldDef } from './fields/codec-types.ts';
import type { JiraIssue, JiraSearchResult } from './types.ts';

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
