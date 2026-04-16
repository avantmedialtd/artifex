## 1. Types and config surface

- [x] 1.1 Add `FieldSchemaType` union (`number`, `string`, `date`, `datetime`, `option`, `option-array`, `user`, `user-array`, `version`, `version-array`, `sprint`, `epic-link`, `unknown`) to a new `jira/lib/fields/codec-types.ts`
- [x] 1.2 Add `CustomFieldDef` interface (`id`, `alias?`, `name`, `schemaType`, `allowedValues?`, `required?`) to `jira/lib/fields/codec-types.ts`
- [x] 1.3 Add `[key: string]: unknown` index signature to `JiraIssueFields` in `jira/lib/types.ts` so `customfield_*` keys typecheck
- [x] 1.4 Add `fields?: Record<string, unknown>` (extra, beyond the typed ones) to `JiraCreateIssueRequest` and `JiraUpdateIssueRequest`, or widen `fields` on both to `Record<string, unknown>` plus the existing known keys
- [x] 1.5 Define `af.json` config shape for `jira.customFields` in an `af.json` loader module (new file `utils/af-config.ts` if one does not exist yet) — support `{ [alias]: { id: string; type?: FieldSchemaType } }`
- [x] 1.6 Write loader tests covering: missing `af.json`, missing `jira` key, missing `customFields` key, malformed id, unknown type override

## 2. Client API additions

- [x] 2.1 Add `getFields()` in `jira/lib/client.ts` that calls `GET /rest/api/3/field` and returns the raw array
- [x] 2.2 Add `getCreateMeta(projectKey, issueTypeName)` in `jira/lib/client.ts` that calls `GET /rest/api/3/issue/createmeta/{projectKey}/issuetypes/{issueTypeId}`, first resolving the issue type id via the existing `getIssueTypes` helper
- [x] 2.3 Extend `createIssue()` signature to accept an optional `customFields?: Record<string, unknown>` param and merge it into the request body's `fields` before POST
- [x] 2.4 Extend `updateIssue()` signature to accept an optional `customFields?: Record<string, unknown>` param and merge it into the request body's `fields` before PUT
- [x] 2.5 Unit tests for each new/extended client function using the existing `vi.mock`-of-fetch pattern (remember: `bun run test`, not `bun test`)

## 3. Cache layer

- [x] 3.1 Create `jira/lib/fields/cache.ts` with `readCache<T>(path, ttlMs)` and `writeCache<T>(path, value)` helpers
- [x] 3.2 Implement `instanceSlug()` helper that derives the slug from `ATLASSIAN_BASE_URL` / `JIRA_BASE_URL` hostname
- [x] 3.3 Implement `fieldsCachePath()` returning `~/.cache/artifex/jira/<slug>/fields.json`
- [x] 3.4 Implement `createMetaCachePath(project, type)` returning `~/.cache/artifex/jira/<slug>/createmeta-<project>-<type>.json`
- [x] 3.5 Implement `invalidateFieldsCache()` and `invalidateCreateMetaCache()` used by `--refresh`
- [x] 3.6 Tests for read/write round-trip, TTL expiry behavior, and invalidation

## 4. Registry and resolver

- [x] 4.1 Create `jira/lib/fields/registry.ts` with `buildRegistry()` that merges config aliases + cached/fetched instance catalog into a `Map<string, CustomFieldDef>` keyed by lowercase alias, lowercase display name, and raw id
- [x] 4.2 Implement `resolve(reference: string): CustomFieldDef` with the three-step precedence: alias → display name (case-insensitive, error on ambiguity) → raw `customfield_\d+` pattern
- [x] 4.3 Implement `enrichWithCreateMeta(projectKey, issueTypeName)` that layers `required` and `allowedValues` onto registry entries from the cached createmeta response
- [x] 4.4 Map Jira's `schema.type` / `schema.items` / `schema.custom` fields to the internal `FieldSchemaType` union (sprint and epic-link are identified by `schema.custom`)
- [x] 4.5 Tests: alias precedence, case-insensitive display-name match, ambiguous display-name error content, raw-id pass-through, unknown-reference error

## 5. Encoder

- [x] 5.1 Create `jira/lib/fields/encoder.ts` with `encode(def: CustomFieldDef, raw: string): unknown`
- [x] 5.2 Implement cases per codec table in the design doc (number, string, date, datetime, option, option-array, version, version-array, sprint-numeric, epic-link)
- [x] 5.3 Implement user / user-array cases that resolve emails via the existing `findUser` helper and reject with an error if no match
- [x] 5.4 Implement the empty-string-as-null rule at the encode entry point (when `raw === ''`, return `null` regardless of type)
- [x] 5.5 Implement the unknown-type fallback: pass raw string, emit a `stderr` warning naming the schema type
- [x] 5.6 Unit tests for each codec case, including empty-string clearing and user resolution failure

## 6. Decoder

- [x] 6.1 Create `jira/lib/fields/decoder.ts` with `decode(def: CustomFieldDef, value: unknown): string`
- [x] 6.2 Implement cases mirroring the encoder (number/string/date/datetime/option/option-array/user/user-array/version/version-array/sprint/epic-link)
- [x] 6.3 Implement the unknown-type fallback: `JSON.stringify(value)`
- [x] 6.4 Unit tests covering each decoder case and null handling

## 7. `af jira fields` subcommand

- [x] 7.1 Add a `fields` case to the subcommand switch in `commands/jira.ts`
- [x] 7.2 Parse `--project`, `--type`, `--refresh`, `--verbose`, `--json` options
- [x] 7.3 Without `--project`/`--type`: list instance-wide fields using the registry
- [x] 7.4 With `--project` and `--type`: enrich the registry with createmeta and include required + allowed-values columns
- [x] 7.5 Implement table output in `jira/lib/formatters.ts` as `formatFields(fields, { verbose, scoped })` returning markdown
- [x] 7.6 Implement JSON output path
- [x] 7.7 End-to-end integration test hitting mocked fetch for both unscoped and scoped invocations

## 8. `--field` / `--field-json` on create and update

- [x] 8.1 Extend `parseArgs` in `commands/jira.ts` to collect repeatable `--field name=value` into an array and `--field-json` into a parsed object
- [x] 8.2 In the `create` handler, resolve each `--field` entry via the registry, encode the value, merge with `--field-json` (JSON wins on conflict), pass as `customFields` to `client.createIssue`
- [x] 8.3 In the `update` handler, do the same and pass to `client.updateIssue`
- [x] 8.4 Surface registry-resolution and codec errors with a nonzero exit
- [x] 8.5 Integration tests for create and update covering: single `--field`, multiple `--field`, mixed `--field` + `--field-json`, clearing via empty value, ambiguous display name, unknown reference

## 9. `get` rendering

- [x] 9.1 Extend `formatIssue` in `jira/lib/formatters.ts` to accept an optional registry and iterate non-null `customfield_*` keys on `issue.fields` after the known-field sections
- [x] 9.2 Render a `## Custom Fields` table with rows `| <alias-or-name> | <decoded value> |`, skipping nulls
- [x] 9.3 Omit the section entirely when no non-null custom fields are present
- [x] 9.4 Wire the `get` handler in `commands/jira.ts` to build a registry lazily and pass it into `formatIssue`
- [x] 9.5 Tests: issue with custom fields renders section, issue without custom fields omits section, alias overrides display name

## 10. `--show-field` on list and search

- [x] 10.1 Add `--show-field a,b,c` option parsing in `commands/jira.ts`
- [x] 10.2 Extend `formatIssueList` to accept an array of resolved `CustomFieldDef` and append one column per entry with decoded values
- [x] 10.3 Wire `list` and `search` handlers to resolve the names once and pass into the formatter
- [x] 10.4 Tests: default output unchanged, `--show-field storyPoints` adds one column, unknown reference errors before the request

## 11. Help text

- [x] 11.1 Update `showJiraHelp` in `commands/jira.ts` to list the new `fields` subcommand and its options
- [x] 11.2 Document `--field` and `--field-json` under CREATE OPTIONS and UPDATE OPTIONS, including the empty-value-clears-field rule
- [x] 11.3 Document `--show-field` under list/search usage
- [x] 11.4 Add at least three new EXAMPLES lines demonstrating fields discovery, create-with-field, and list-with-show-field

## 12. Documentation and sanity

- [x] 12.1 Update `CLAUDE.md`'s Jira section to mention custom-field support and `af.json` aliases
- [x] 12.2 Run `bun run format`, `bun run lint`, and `bun run spell:check`
- [x] 12.3 Run `bun run test` and ensure everything passes
- [ ] 12.4 Run `af jira fields --json` against a real instance as a smoke check (manual)
