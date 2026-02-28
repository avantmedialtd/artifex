# Design: Add Confluence Command

## Context

The `af jira` command provides full Jira issue management via a CLI, used primarily by AI agents for automated project management workflows. Confluence is the complementary knowledge management tool in the Atlassian suite. Both share the same authentication (Atlassian Cloud API tokens) and use ADF (Atlassian Document Format) for rich content.

The Jira client currently contains shared concerns (ADF conversion, auth config) tightly coupled to its module. Adding Confluence as a parallel client requires extracting these shared concerns.

## Goals / Non-Goals

**Goals:**

- Full CRUD for Confluence pages, comments, labels, attachments, and spaces
- Share authentication and ADF infrastructure between Jira and Confluence
- Rename env vars to `ATLASSIAN_*` while maintaining `JIRA_*` backward compatibility
- Mirror the `af jira` command patterns (arg parsing, dual JSON/markdown output, lazy loading)

**Non-Goals:**

- Confluence-specific features beyond core content management (blueprints, templates, permissions, restrictions)
- Real-time collaboration or watching for page changes
- Storage format (XHTML) support — ADF only for now
- Refactoring the Jira client's internal `request()` function to use the shared one (kept local to minimize risk)

## Decisions

### 1. Sibling module layout (`confluence/lib/` alongside `jira/lib/`)

Shared code extracted to `atlassian/lib/`. Keeps existing `jira/` paths stable.

```
atlassian/lib/    ← shared config, ADF, request
jira/lib/         ← Jira-specific client, formatters, types
confluence/lib/   ← Confluence-specific client, formatters, types
```

**Alternative considered:** Consolidating under `atlassian/lib/jira/` and `atlassian/lib/confluence/`. Rejected because it would change all Jira import paths, breaking backward compatibility for no benefit.

### 2. ADF as content format (not Storage Format)

Confluence v2 API supports both ADF and Storage Format (XHTML). Using ADF because:
- Already have `textToAdf()` / `adfToText()` converters from Jira
- Maximizes code reuse — same markdown ↔ ADF round-trip for both products
- ADF is Atlassian's forward-looking format

**Trade-off:** Some Confluence features (macros, complex layouts) are easier in Storage Format. Can be added later if needed.

### 3. Mixed v2/v1 API usage

Confluence v2 API is incomplete. Strategy:
- **v2** (`/wiki/api/v2/`): Pages, spaces, comments, hierarchy, read attachments/labels
- **v1** (`/wiki/rest/api/`): Search (CQL), upload attachments, manage labels

**Trade-off:** Two API versions means two URL construction patterns. Isolated via `v2Url()` and `v1Url()` helpers in the client.

### 4. Env var naming with fallback

`ATLASSIAN_*` preferred, `JIRA_*` as fallback. Single error message lists all legacy vars when none are set.

**Alternative considered:** Renaming `JIRA_*` completely with a deprecation warning. Rejected — would break existing setups for no immediate benefit.

### 5. Space key → ID resolution

Confluence v2 API uses space IDs internally, but users think in space keys (e.g., `MYSPACE`). The client resolves key to ID via `GET /wiki/api/v2/spaces?keys=KEY` before operations that need it.

**Trade-off:** Extra API call per space-key operation. Acceptable since it's one lightweight lookup per command invocation.

## Risks / Trade-offs

- **[ADF fidelity]** Complex Confluence pages with macros, tables, or embedded content may not round-trip perfectly through ADF ↔ markdown conversion → Acceptable for agent use cases; agents primarily create simple structured content
- **[v2 API stability]** Confluence v2 API is still evolving; endpoints may change → Pin to known-working endpoints, isolate API version in URL helpers
- **[Version conflicts on update]** Page updates require version increment; concurrent edits cause 409 Conflict → Client auto-fetches current version before update; standard optimistic locking
