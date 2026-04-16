## Why

The `af jira` command models only Jira's "known" fields (summary, description, priority, labels, versions, time tracking). In real Jira instances, many projects require **custom fields** (Story Points, Sprint, Severity, instance-specific selectors) on issue creation, and those same fields are silently dropped from `get` output. Users working against such instances cannot create issues through `af` at all — they must fall back to the web UI — and cannot inspect custom-field values once issues exist. Closing this gap makes the CLI usable against arbitrary Jira configurations instead of only the default schema.

## What Changes

- Add a cached **field registry** that merges three sources: `af.json` aliases, Jira's instance-wide `GET /rest/api/3/field` catalog, and per-project-type `createmeta`.
- Add `af jira fields` subcommand for discovery. Supports `--project` and `--type` filters and a `--refresh` flag to invalidate the cache. Output lists id, name, schema type, required flag, and allowed values.
- Add `--field name=value` (repeatable) and `--field-json '{...}'` (escape hatch) flags to `af jira create` and `af jira update`. Name resolves by alias → display name → raw `customfield_id`, in that order, with ambiguous display-name matches erroring.
- An empty value (`--field foo=`) clears the field (sends `null`); literal empty strings are not supported for custom fields.
- Extend `af jira get` to render a "Custom Fields" section listing non-null custom-field values, formatted per schema type.
- Add `--show-field a,b,c` to `af jira list` / `af jira search` to opt specific custom fields in as extra columns. Custom fields remain hidden from those views by default.
- Define a codec keyed on Jira's `schema.type` (number, string, date, datetime, option, options, user, users, version, versions, sprint, epic-link). Sprint accepts the numeric sprint ID only. Epic link accepts an issue key. Unknown types are passed through with a warning.
- No proactive required-field validation on create. Users inspect `af jira fields` themselves; Jira's rejection message surfaces unchanged on failure.
- Add an `af.json` `jira.customFields` config section mapping aliases to `customfield_*` ids (type optional; auto-discovered from the registry when omitted).

## Capabilities

### New Capabilities

- `jira-custom-fields`: Discovery, encoding, decoding, and caching of Jira custom fields, including the field registry, codec, and `af jira fields` subcommand.

### Modified Capabilities

- `jira-command`: Adds `--field`/`--field-json` flags to `create` and `update`, a "Custom Fields" section to `get` output, and `--show-field` to `list` / `search`.

## Impact

- **New code** under `jira/lib/fields/` (registry, encoder, decoder, codec types). Estimated ~500 LoC.
- **Modified**: `commands/jira.ts` (flag parsing, help text), `jira/lib/client.ts` (custom-field params on create/update, `getFields()`, `getCreateMeta()`), `jira/lib/formatters.ts` (custom-fields rendering, `--show-field`), `jira/lib/types.ts` (relax `JiraIssueFields` to allow arbitrary `customfield_*` keys).
- **New config surface**: optional `jira.customFields` in `af.json`. Backwards-compatible — absence changes nothing.
- **New filesystem surface**: cache under `~/.cache/artifex/jira/<instance-slug>/` (`fields.json` with 24h TTL; `createmeta-<project>-<type>.json` with 1h TTL).
- **No breaking changes** to existing flags or output. Known-field rendering on `get` is unchanged; custom fields appear in an additive section.
