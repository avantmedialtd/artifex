import type { FieldSchemaType, JiraFieldSchema } from './codec-types.ts';

const SPRINT_CUSTOM = 'com.pyxis.greenhopper.jira:gh-sprint';
const EPIC_LINK_CUSTOM = 'com.pyxis.greenhopper.jira:gh-epic-link';

export function mapSchemaType(schema: JiraFieldSchema | undefined): FieldSchemaType {
    if (!schema) return 'unknown';
    if (schema.custom === SPRINT_CUSTOM) return 'sprint';
    if (schema.custom === EPIC_LINK_CUSTOM) return 'epic-link';

    switch (schema.type) {
        case 'number':
            return 'number';
        case 'string':
            return 'string';
        case 'date':
            return 'date';
        case 'datetime':
            return 'datetime';
        case 'option':
            return 'option';
        case 'user':
            return 'user';
        case 'version':
            return 'version';
        case 'array':
            switch (schema.items) {
                case 'option':
                    return 'option-array';
                case 'user':
                    return 'user-array';
                case 'version':
                    return 'version-array';
                case 'string':
                    return 'string';
                default:
                    return 'unknown';
            }
        default:
            return 'unknown';
    }
}
