## Context

The Jira CLI currently supports issue CRUD, comments, transitions, assignments, attachments, and version management. Two linking mechanisms are missing:

1. **Issue links** — typed directional relationships between two Jira issues (e.g., "blocks", "duplicates"). These are part of the issue's `issuelinks` field, returned by `GET /issue/{key}`. The API for creating/deleting them is `/rest/api/3/issueLink`.

2. **Remote links** — URL-based links from a Jira issue to any external resource. These are NOT part of the issue fields — they require a separate API call to `/rest/api/3/issue/{key}/remotelink`. Creating one requires only a URL and title.

Both use the shared Atlassian auth infrastructure already in `atlassian/lib/`.

## Goals / Non-Goals

**Goals:**

- Display issue links in `af jira get` output
- Create and remove issue-to-issue links via `af jira link` / `af jira unlink`
- Display remote links in `af jira get` output
- List, add, and remove remote links via `af jira remote-link`
- Follow existing CLI patterns for option parsing, help, and output formatting

**Non-Goals:**

- No Confluence-specific logic — remote links are generic URL + title
- No bulk link operations
- No link type discovery command (users specify link type names directly)

## Decisions

### Issue link directionality model

Issue links are directional: a link has an `outwardIssue` and an `inwardIssue`. When creating a link with `POST /issueLink`, the caller specifies which issue is outward and which is inward. The type has separate labels for each direction (e.g., outward: "blocks", inward: "is blocked by").

**Decision**: The `link` command treats the first argument as the outward issue and `--to` as the inward issue. The `--type` value maps to the link type name (e.g., "Blocks"). Default type: "Blocks".

```
af jira link PROJ-123 --to PROJ-456 --type "Blocks"
→ PROJ-123 blocks PROJ-456
```

**Alternative considered**: Auto-detect direction from type label. Rejected — adds complexity, the Jira API already handles this by type name.

### Unlink by target key, not link ID

**Decision**: `af jira unlink PROJ-123 --from PROJ-456` finds the link between the two issues by fetching PROJ-123's issue links and matching against PROJ-456, then deletes by the link's internal ID.

**Alternative considered**: `af jira unlink <link-id>`. Rejected — users don't think in link IDs, they think "remove the link between these two issues". The command fetches the issue to resolve the ID internally.

### Remote link removal by ID

**Decision**: `af jira remote-link PROJ-123 --remove <link-id>` uses the numeric remote link ID. The ID is visible in `af jira remote-link PROJ-123` list output.

**Rationale**: Unlike issue links where there's a natural key (the target issue key), remote links have no natural unique key — multiple links could share the same URL or title. The numeric ID is the only reliable identifier.

### Extra API call for remote links in `af jira get`

**Decision**: `af jira get` makes a second request to `/issue/{key}/remotelink` to fetch remote links, since they aren't included in the issue fields response.

**Rationale**: The cost is one additional HTTP request. The value is showing the complete picture of an issue's links in a single command. Both requests can run in parallel with `Promise.all`.

### Type model additions

**Decision**: Add issue link types to `jira/lib/types.ts`. Remote links use a minimal inline type (id, url, title) since the response structure is simple and not shared elsewhere.

## Risks / Trade-offs

- **Extra latency on `af jira get`**: The parallel remote link fetch adds ~100-200ms. → Acceptable for the completeness of the output.
- **Link type name mismatch**: Users must specify the exact Jira link type name (e.g., "Blocks" not "blocks"). → The Jira API is case-sensitive here. Error messages from the API will guide the user.
- **Unlink ambiguity**: If two issues have multiple links between them (e.g., both "blocks" and "relates to"), `af jira unlink` removes the first match. → Acceptable for v1. Users can unlink and re-link to fix if needed.
