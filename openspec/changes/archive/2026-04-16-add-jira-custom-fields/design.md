## Context

The current Jira client (`jira/lib/client.ts`) is strongly typed around the fields it knows: summary, description, priority, labels, parent, time tracking, fix/affected versions. Everything else that the Jira API returns under `fields` is silently discarded by `JiraIssueFields`, and there is no way to pass additional fields on create or update. In instances where custom fields are **required** for issue creation (Story Points, Sprint, Severity, or instance-specific selectors), the CLI is unusable end-to-end — users have to fall back to the web UI.

Jira identifies custom fields by opaque IDs like `customfield_10016`. The JSON encoding of a value differs by field's `schema.type`: a number is `5`, a single-select option is `{ "value": "High" }`, a user picker is `{ "accountId": "..." }`, a cascading select is `{ "value": "A", "child": { "value": "A1" } }`, Sprint is the numeric sprint ID, and Epic Link is a plain issue-key string. Discovery of fields uses two endpoints: `GET /rest/api/3/field` (instance-wide catalog) and `GET /rest/api/3/issue/createmeta/{project}/issuetypes/{type}` (per-project-type, including which fields are required and their allowed values).

Users want to:
1. Create issues with required custom fields filled in from the CLI.
2. See custom-field values when inspecting issues.
3. Update custom-field values on existing issues.
4. Not have to memorize `customfield_*` IDs, but still have a raw escape hatch.

## Goals / Non-Goals

**Goals:**

- Full CRUD over custom fields from the CLI (create, read, update; delete is covered by the existing `delete` command).
- Ergonomic reference to fields by configured alias or display name, with raw IDs as a fallback.
- Instance-agnostic: works against any Jira configuration without code changes.
- Discoverability: `af jira fields` tells users what the instance has and what's required for a given project+type.
- Cache API metadata locally so discovery is fast after the first call.

**Non-Goals:**

- Proactive required-field validation on create. Let Jira reject and surface the error.
- Resolving sprint names to IDs. Sprint accepts numeric IDs only in the MVP.
- Cascading-select / complex-option sugar. `--field-json` is the escape hatch.
- First-class support for Jira-app-provided custom field types beyond the common schema types. Unknown types pass through with a warning.
- Writing custom fields through any path other than the CLI flags (no interactive prompt, no from-file).

## Decisions

### Decision 1 — Registry as the single source of truth

All custom-field metadata goes through one in-process registry that merges three inputs:

1. `af.json`'s `jira.customFields` (aliases).
2. `GET /rest/api/3/field` (instance-wide catalog).
3. `GET /rest/api/3/issue/createmeta/{project}/issuetypes/{type}` (per-project-type, lazy).

The registry exposes a single `resolve(name): { id, schemaType, allowedValues?, required? }` function that both the encoder (write path) and decoder (read path) consume.

**Alternatives considered:**

- Resolve from config directly, without discovery. Rejected: users don't want to specify schema type for every alias, and display-name lookup is valuable.
- Treat each source independently at each call site. Rejected: scatter causes inconsistent resolution rules across create/update/get.

**Why:** one resolution path means one set of rules for precedence, one caching strategy, one code path to test.

### Decision 2 — Resolution precedence: alias → display name → raw ID

When the user writes `--field foo=value`:

1. If `foo` matches a configured alias in `af.json`, use its `id`.
2. Else, if `foo` matches exactly one field's display name (case-insensitive), use that field's `id`.
3. Else, if `foo` matches the regex `/^customfield_\d+$/`, treat as a raw ID.
4. Else, error.

If `foo` matches multiple display names, error with a message listing the candidates so the user can disambiguate by alias or raw ID.

**Alternatives considered:**

- Fuzzy matching on display names. Rejected: silent wrong-field selection is a data-integrity risk.
- Display-name match before alias. Rejected: users should be able to pin specific behavior via `af.json` without a display-name change breaking them.

### Decision 3 — Codec keyed on Jira's `schema.type`

An encode/decode function table, keyed on the `schema.type` value that Jira returns in field metadata:

| `schema.type` | Write encoding | Read formatting |
|---|---|---|
| `number` | `Number(raw)` | `String(value)` |
| `string` | `raw` | `value` |
| `date` | `raw` (expects `YYYY-MM-DD`) | `value` |
| `datetime` | `raw` (expects ISO 8601) | formatted via `toLocaleString` |
| `option` | `{ value: raw }` | `value.value` |
| `array` of `option` | split on `,` → `[{value}, ...]` | join `value.value` |
| `user` | resolve via `findUser` → `{ accountId }` | `value.displayName` |
| `array` of `user` | split on `,` → resolve each | join `displayName` |
| `version` | `{ name: raw }` | `value.name` |
| `array` of `version` | split on `,` → `[{name}, ...]` | join `name` |
| `sprint` (custom: `com.pyxis.greenhopper.jira:gh-sprint`) | `Number(raw)` | `value.name` |
| Epic Link (custom: `com.pyxis.greenhopper.jira:gh-epic-link`) | `raw` (issue key) | `value` |
| unknown | `raw` as string + stderr warning | `JSON.stringify(value)` |

**Alternatives considered:**

- Reflect into the Jira schema at runtime for each field. Rejected: overkill; a fixed table covers the vast majority of instances.
- Let users write raw JSON for every field. Rejected: defeats the ergonomics goal.

### Decision 4 — Empty string clears the field

`--field foo=` (empty after `=`) encodes to `null` in the update payload. Literal empty strings are not representable through `--field`; a user who truly needs one must use `--field-json '{"customfield_XXX": ""}'`. The common case (clearing) is one flag; the rare case (literal empty) is still reachable.

**Alternatives considered:**

- Dedicated `--clear-field foo` flag. Rejected: one flag instead of two is simpler, and the edge case is genuinely rare.

### Decision 5 — No proactive required-field validation

On create, the CLI sends whatever the user provided and lets Jira's 400 response propagate. Users discover required fields through `af jira fields --project P --type T`, which reads them straight from `createmeta` and marks them with a `✓` in the `Required` column.

**Alternatives considered:**

- Auto-fetch `createmeta` before every `create` call. Rejected: one extra round-trip on every create for a check the user can run on demand.
- Enrich create-failure errors by fetching `createmeta` on 400. Considered for a follow-up; out of MVP scope.

### Decision 6 — Cache layout and TTL

Two-file cache under `~/.cache/artifex/jira/<instance-slug>/`:

- `fields.json`: instance-wide `GET /field` result. TTL 24h. Rarely changes in practice.
- `createmeta-<project>-<type>.json`: per-project-type metadata. TTL 1h. More volatile because project schemes change.

`<instance-slug>` is derived from `ATLASSIAN_BASE_URL` (hostname, lowercased, non-alphanumerics replaced with `-`). This isolates caches when a user switches between instances.

`af jira fields --refresh` forces a rebuild by deleting matching cache files before fetching. No on-disk migration is needed because cache is purely derived data.

**Alternatives considered:**

- In-memory only. Rejected: `af` is a short-lived CLI; every invocation would re-fetch.
- Single cache file for everything. Rejected: `createmeta` churn would invalidate the stable field catalog.

### Decision 7 — Relaxed `JiraIssueFields` type

`JiraIssueFields` gains a `[key: string]: unknown` index signature so that `fields.customfield_10016` and friends are legal. Known fields keep their specific types. This is a typing relaxation only; no runtime impact.

**Alternatives considered:**

- Parse custom fields into a separate `customFields: Record<string, unknown>` property. Rejected: the API response doesn't look like that, and every call site would need to normalize.

### Decision 8 — `--show-field` for list/search

On `af jira list` and `af jira search`, custom fields stay hidden by default because the table is already wide. `--show-field a,b,c` appends one column per entry, resolved the same way as `--field` (alias → display name → raw ID). Values are formatted by the same decoder used in `get`.

## Risks / Trade-offs

- **[Cache staleness after schema changes]** → 24h TTL on field catalog means a newly added custom field isn't visible until the next refresh. Mitigated by `--refresh` and by documenting the flag prominently in `af jira fields` help.
- **[Display-name collisions]** → two custom fields may share the same display name. Ambiguity is caught at resolve time with an error that lists the candidate IDs; the user picks one by raw ID or by adding an alias.
- **[Unknown schema types]** → Jira apps can define arbitrary schema types. The codec falls back to "pass the raw string through, stringify JSON on read, warn on stderr." Users hitting this will see the warning and can reach for `--field-json` if the raw pass-through doesn't work.
- **[User pickers with ambiguous emails]** → same shape as the existing `findUser`-based `assignIssue` path; we reuse it, so we inherit whatever behavior that has.
- **[Sprint-as-number ergonomics]** → users must look up sprint IDs manually in the MVP. This is an explicit, accepted limitation; board→sprint name resolution is a potential follow-up.
- **[Silent drop on typo when clearing]** → `--field foo=` clears `foo`, and if `foo` is misspelled, resolution errors. No silent drop, so this is acceptable.

## Migration Plan

Additive change only. No existing behavior is modified; new flags and the new subcommand are strictly additive. No migration needed for existing users or `af.json` files. New cache directory is created on first use.

## Open Questions

None blocking implementation. The following are parking-lot items for future iterations:

- Board→sprint name resolution (would turn the sprint limitation from "numeric ID only" into "name accepted").
- Enriched error message on create 400 that auto-fetches `createmeta` and tells the user exactly what's missing.
- Cascading-select ergonomic sugar (something like `--field severity=A/A1`) if it turns out cascading fields are common.
