export type FieldSchemaType =
    | 'number'
    | 'string'
    | 'date'
    | 'datetime'
    | 'option'
    | 'option-array'
    | 'user'
    | 'user-array'
    | 'version'
    | 'version-array'
    | 'sprint'
    | 'epic-link'
    | 'unknown';

export interface CustomFieldDef {
    id: string;
    alias?: string;
    name: string;
    schemaType: FieldSchemaType;
    allowedValues?: string[];
    required?: boolean;
}

export interface JiraFieldSchema {
    type: string;
    items?: string;
    custom?: string;
    system?: string;
}

export interface JiraFieldCatalogEntry {
    id: string;
    name: string;
    custom: boolean;
    schema?: JiraFieldSchema;
}

export interface JiraCreateMetaField {
    required: boolean;
    schema?: JiraFieldSchema;
    name: string;
    fieldId: string;
    allowedValues?: Array<{ value?: string; name?: string; id?: string }>;
}

export interface JiraCreateMetaResponse {
    fields: JiraCreateMetaField[];
}
