# jira-custom-fields Specification

## Purpose

Provide discovery, encoding, decoding, and caching of Jira custom fields for the `af jira` CLI so that users can create, read, and update issues that rely on arbitrary custom fields (including required ones) without falling back to the web UI.

## Requirements

### Requirement: Field registry and resolution

The CLI SHALL maintain an in-process field registry that resolves a user-supplied field reference to a Jira custom field ID, schema type, and (where available) allowed values. The registry SHALL be seeded from three sources: `af.json` aliases under `jira.customFields`, the instance-wide `GET /rest/api/3/field` response, and per-project-type `GET /rest/api/3/issue/createmeta/{project}/issuetypes/{type}` responses.

The registry SHALL resolve a reference using this precedence, in order:

1. Exact match against a configured alias in `af.json`.
2. Case-insensitive exact match against a field's display name from Jira's field catalog. If more than one field matches, resolution fails with an error listing the candidate IDs.
3. The reference matches the regex `/^customfield_\d+$/` and is treated as a raw ID.

If none of the three match, resolution fails with an error naming the reference.

#### Scenario: Resolving an alias

- **GIVEN** `af.json` contains `{"jira":{"customFields":{"storyPoints":{"id":"customfield_10016"}}}}`
- **WHEN** the CLI resolves the reference `storyPoints`
- **THEN** resolution succeeds with id `customfield_10016`
- **AND** the alias source takes precedence over any display-name collision

#### Scenario: Resolving by display name

- **GIVEN** Jira returns a single custom field whose display name is `Story Points`
- **AND** no alias is configured for that name
- **WHEN** the CLI resolves the reference `Story Points`
- **THEN** resolution succeeds with that field's id
- **AND** the match is case-insensitive

#### Scenario: Ambiguous display name

- **GIVEN** two distinct custom fields both have the display name `Severity`
- **WHEN** the CLI resolves the reference `Severity`
- **THEN** resolution fails with an error that lists the conflicting `customfield_*` ids
- **AND** the error suggests configuring an alias or using the raw id

#### Scenario: Raw customfield id

- **WHEN** the CLI resolves the reference `customfield_10099`
- **THEN** resolution succeeds with id `customfield_10099` without consulting the catalog for a name match

#### Scenario: Unknown reference

- **GIVEN** no alias, display-name, or raw-id match exists
- **WHEN** the CLI resolves the reference `nonsense`
- **THEN** resolution fails with an error naming the unknown reference

### Requirement: Fields discovery subcommand

The CLI SHALL provide `af jira fields` to report custom-field metadata. Invocation without filters SHALL list every custom field from the instance-wide catalog. Invocation with `--project <key>` and `--type <name>` SHALL restrict the listing to fields available for that project+type combination and SHALL mark fields that Jira reports as required.

The default output SHALL include columns: alias (if configured), id, name, schema type, required flag, and allowed values (for option-typed fields). A `--verbose` flag SHALL add the full raw schema. A `--refresh` flag SHALL invalidate the relevant cache files before fetching. A `--json` flag SHALL emit the raw JSON structure instead of a formatted table.

#### Scenario: List instance-wide fields

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira fields`
- **THEN** every custom field known to the instance is listed in a table with id, name, and schema type columns

#### Scenario: List fields required for a project+type

- **GIVEN** valid Jira credentials in environment
- **AND** project `PROJ` requires a custom field `Story Points` on issue type `Story`
- **WHEN** the user runs `af jira fields --project PROJ --type Story`
- **THEN** the output table includes `Story Points` with a marker indicating it is required
- **AND** the table lists only fields available for that project+type combination

#### Scenario: Show allowed values for option fields

- **GIVEN** valid Jira credentials in environment
- **AND** a custom field `Severity` is a single-select with options `Low`, `Medium`, `High`
- **WHEN** the user runs `af jira fields --project PROJ --type Bug`
- **THEN** the `Severity` row shows `Low, Medium, High` in the allowed-values column

#### Scenario: Refresh cache

- **GIVEN** the instance-wide fields cache is populated
- **WHEN** the user runs `af jira fields --refresh`
- **THEN** the cache file for the instance catalog is removed before the request is made
- **AND** the output reflects the freshly fetched data

#### Scenario: JSON output

- **WHEN** the user runs `af jira fields --json`
- **THEN** the output is the raw JSON structure rather than the formatted table

### Requirement: Custom field values on create

The CLI SHALL accept `--field <name>=<value>` (repeatable) and `--field-json <object>` on `af jira create`. Values from `--field` SHALL be encoded according to the resolved field's schema type (see schema-type codec requirement). Values from `--field-json` SHALL be merged into the `fields` property of the create payload verbatim and SHALL override any `--field` entry that targets the same id.

The CLI SHALL NOT perform proactive required-field validation; a create that omits a field Jira marks as required SHALL be sent as submitted, and any resulting Jira error message SHALL be surfaced to the user unchanged.

#### Scenario: Create with a scalar custom field

- **GIVEN** `storyPoints` resolves to `customfield_10016` with schema type `number`
- **WHEN** the user runs `af jira create --project PROJ --type Story --summary "X" --field storyPoints=5`
- **THEN** the create request body contains `fields.customfield_10016` set to the numeric value `5`

#### Scenario: Create with multiple custom fields

- **WHEN** the user runs `af jira create --project PROJ --type Story --summary "X" --field storyPoints=5 --field severity=High`
- **THEN** both resolved ids appear in `fields` with their respective encoded values

#### Scenario: Create using the JSON escape hatch

- **WHEN** the user runs `af jira create --project PROJ --type Story --summary "X" --field-json '{"customfield_10050":{"value":"A","child":{"value":"A1"}}}'`
- **THEN** the create request body merges that object into `fields` verbatim

#### Scenario: Required field missing surfaces Jira error

- **GIVEN** project `PROJ` requires custom field `Story Points` on issue type `Story`
- **WHEN** the user runs `af jira create --project PROJ --type Story --summary "X"` without supplying that field
- **THEN** the CLI submits the request
- **AND** on Jira's 400 response, the CLI surfaces Jira's error message
- **AND** the CLI exits with code 1

### Requirement: Custom field values on update

The CLI SHALL accept `--field <name>=<value>` (repeatable) and `--field-json <object>` on `af jira update`. A `--field <name>=` entry with an empty value after `=` SHALL encode to JSON `null`, clearing the field. Literal empty strings SHALL NOT be representable through `--field`; users needing one SHALL use `--field-json`.

#### Scenario: Update a scalar custom field

- **GIVEN** issue `PROJ-123` exists
- **WHEN** the user runs `af jira update PROJ-123 --field storyPoints=8`
- **THEN** the update request body contains `fields.customfield_10016` set to `8`

#### Scenario: Clear a custom field with empty value

- **GIVEN** issue `PROJ-123` has `Severity` set
- **WHEN** the user runs `af jira update PROJ-123 --field severity=`
- **THEN** the update request body contains `fields.customfield_10099` set to `null`

#### Scenario: Update using the JSON escape hatch

- **WHEN** the user runs `af jira update PROJ-123 --field-json '{"customfield_10050":null}'`
- **THEN** the update request body merges that object into `fields`

### Requirement: Custom field display on get

The CLI SHALL render non-null custom-field values on `af jira get` as a section titled `Custom Fields`, following the existing known-field sections. Each row SHALL show the alias if one is configured, otherwise the field's display name from the registry. Values SHALL be formatted per schema type by the decoder (see schema-type codec requirement). The section SHALL be omitted when the issue has no non-null custom fields.

#### Scenario: Get issue with custom fields

- **GIVEN** issue `PROJ-123` has `customfield_10016` (Story Points) set to `5` and `customfield_10099` (Severity) set to `{"value":"High"}`
- **WHEN** the user runs `af jira get PROJ-123`
- **THEN** the output contains a `Custom Fields` section with rows `Story Points | 5` and `Severity | High`

#### Scenario: Get issue with no custom field values

- **GIVEN** issue `PROJ-123` has no non-null custom-field values
- **WHEN** the user runs `af jira get PROJ-123`
- **THEN** the output omits the `Custom Fields` section

#### Scenario: Alias overrides display name

- **GIVEN** `af.json` aliases `customfield_10016` as `storyPoints`
- **AND** the Jira display name for that field is `Story Points`
- **WHEN** the user runs `af jira get PROJ-123`
- **THEN** the row label in the `Custom Fields` section is `storyPoints`

### Requirement: Custom field display on list and search

The CLI SHALL accept `--show-field <names>` on `af jira list` and `af jira search`, where `<names>` is a comma-separated list of field references resolved by the same precedence rules as `--field`. Each listed field SHALL appear as an additional column in the results table. When the option is absent, custom fields SHALL NOT appear in the table.

#### Scenario: Hidden by default

- **WHEN** the user runs `af jira list PROJ`
- **THEN** the table shows only the existing built-in columns and no custom-field columns

#### Scenario: Show specified custom fields as columns

- **GIVEN** `storyPoints` resolves to `customfield_10016`
- **WHEN** the user runs `af jira list PROJ --show-field storyPoints,severity`
- **THEN** the table includes two additional columns, `Story Points` and `Severity`, with each issue's decoded values

### Requirement: Schema-type codec

The CLI SHALL encode `--field` values to Jira JSON and decode Jira JSON to display strings using a fixed codec keyed on the field's `schema.type`. The codec SHALL support: `number`, `string`, `date`, `datetime`, `option`, arrays of `option`, `user`, arrays of `user`, `version`, arrays of `version`, sprint (Jira custom schema type `com.pyxis.greenhopper.jira:gh-sprint`), and Epic Link (Jira custom schema type `com.pyxis.greenhopper.jira:gh-epic-link`). Unknown schema types SHALL pass the raw string through on write and `JSON.stringify` the value on read, and SHALL emit a warning to stderr.

Sprint values on write SHALL be the numeric sprint ID only. Epic Link values on write SHALL be an issue key string.

#### Scenario: Encode a number field

- **WHEN** the codec encodes the raw value `5` for a field with schema type `number`
- **THEN** the JSON value is the number `5`

#### Scenario: Encode a single-select option

- **WHEN** the codec encodes the raw value `High` for a field with schema type `option`
- **THEN** the JSON value is `{"value":"High"}`

#### Scenario: Encode a multi-select option

- **WHEN** the codec encodes the raw value `A,B` for an array of `option`
- **THEN** the JSON value is `[{"value":"A"},{"value":"B"}]`

#### Scenario: Encode a user picker

- **GIVEN** the user resolver maps `alice@example.com` to account id `abc123`
- **WHEN** the codec encodes `alice@example.com` for a field with schema type `user`
- **THEN** the JSON value is `{"accountId":"abc123"}`

#### Scenario: Encode a sprint field

- **WHEN** the codec encodes `12345` for a sprint field
- **THEN** the JSON value is the number `12345`

#### Scenario: Encode an Epic Link field

- **WHEN** the codec encodes `PROJ-42` for an Epic Link field
- **THEN** the JSON value is the string `"PROJ-42"`

#### Scenario: Unknown schema type falls through with warning

- **GIVEN** a custom field has a schema type the codec does not recognize
- **WHEN** the codec encodes a raw value for that field
- **THEN** the JSON value is the raw string
- **AND** a warning is emitted to stderr naming the unrecognized schema type

#### Scenario: Decode a user field

- **WHEN** the codec decodes `{"accountId":"abc123","displayName":"Alice"}` for a `user` field
- **THEN** the display string is `Alice`

#### Scenario: Decode an option array

- **WHEN** the codec decodes `[{"value":"A"},{"value":"B"}]` for an array-of-option field
- **THEN** the display string is `A, B`

### Requirement: Cache layout and refresh

The CLI SHALL cache Jira field metadata on the local filesystem under `~/.cache/artifex/jira/<instance-slug>/`, where `<instance-slug>` is derived from `ATLASSIAN_BASE_URL` by taking the hostname, lowercasing it, and replacing non-alphanumeric characters with `-`. The instance-wide field catalog SHALL be cached in `fields.json` with a TTL of 24 hours. Per-project-type createmeta responses SHALL be cached in `createmeta-<project>-<type>.json` with a TTL of 1 hour. When a cache file is older than its TTL or missing, the CLI SHALL fetch fresh data and rewrite the file. The `--refresh` flag on `af jira fields` SHALL delete matching cache files before fetching.

#### Scenario: Cache hit within TTL

- **GIVEN** `fields.json` was written 5 minutes ago
- **WHEN** the CLI consults the instance catalog
- **THEN** it reads `fields.json` without making an HTTP request

#### Scenario: Cache miss on expiry

- **GIVEN** `fields.json` was written 25 hours ago
- **WHEN** the CLI consults the instance catalog
- **THEN** it fetches `GET /rest/api/3/field`
- **AND** writes the response to `fields.json`

#### Scenario: Explicit refresh

- **GIVEN** `fields.json` exists and is within TTL
- **WHEN** the user runs `af jira fields --refresh`
- **THEN** the existing `fields.json` is removed before fetching
- **AND** the freshly fetched response is written to `fields.json`

#### Scenario: Instance slug isolates caches

- **GIVEN** `ATLASSIAN_BASE_URL=https://acme.atlassian.net`
- **WHEN** the CLI writes the instance catalog cache
- **THEN** the file path is `~/.cache/artifex/jira/acme-atlassian-net/fields.json`

### Requirement: Configuration of custom field aliases

The CLI SHALL read optional custom-field aliases from `af.json` under the key `jira.customFields`. Each entry SHALL map an alias name to an object with a required `id` property of the form `customfield_<digits>` and an optional `type` property that overrides the schema type normally derived from the registry. Absence of the configuration section SHALL cause no change to behavior.

#### Scenario: Alias with id only

- **GIVEN** `af.json` contains `{"jira":{"customFields":{"storyPoints":{"id":"customfield_10016"}}}}`
- **WHEN** the CLI resolves `storyPoints`
- **THEN** resolution uses id `customfield_10016`
- **AND** the schema type is taken from the registry entry for that id

#### Scenario: Alias with type override

- **GIVEN** `af.json` contains `{"jira":{"customFields":{"sprint":{"id":"customfield_10020","type":"sprint"}}}}`
- **WHEN** the codec encodes a value for `sprint`
- **THEN** it uses the `sprint` codec regardless of the registry's inferred schema type

#### Scenario: No configuration section

- **GIVEN** `af.json` has no `jira.customFields` key
- **WHEN** the CLI resolves a reference
- **THEN** only the display-name and raw-id resolution paths are consulted
