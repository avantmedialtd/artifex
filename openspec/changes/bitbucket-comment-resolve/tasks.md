## 1. Verify the Bitbucket comment-resolution API (design D5)

- [ ] 1.1 Against a live test PR, create an inline comment and resolve it in the Bitbucket UI _(deferred: needs live Bitbucket access)_
- [ ] 1.2 GET the single comment and the comment list; record whether `resolution` is present, its exact field names, and whether it appears on the list endpoint or only the single-comment GET _(deferred: confirmed against official docs, pending live confirmation)_
- [ ] 1.3 Probe the toggle: try `POST …/comments/{cid}/resolve` then `DELETE …/comments/{cid}/resolve`; record status codes and resulting `resolution`. If 404, try `PUT` with a resolution field _(deferred: endpoint confirmed against official docs, pending live confirmation)_
- [x] 1.4 Record the confirmed endpoint, method, and response shape in the `client.ts` header note (mirroring the existing task-resolution note)

## 2. Types

- [x] 2.1 Add the verified `resolution` field to `BitbucketComment` in `bitbucket/lib/types.ts`

## 3. API client

- [x] 3.1 Add `resolveComment(workspace, repo, prId, commentId)` to `bitbucket/lib/client.ts` using the verified endpoint/method
- [x] 3.2 Add `reopenComment(workspace, repo, prId, commentId)` to `bitbucket/lib/client.ts`
- [x] 3.3 Add `client.test.ts` cases asserting the request method, URL, and body for resolve and reopen

## 4. Command routing

- [x] 4.1 Route `af bb pr comment resolve <pr-id> <comment-id>` in `commands/bitbucket.ts`, requiring a comment id (error + exit 1 when missing)
- [x] 4.2 Route `af bb pr comment reopen <pr-id> <comment-id>` in `commands/bitbucket.ts`
- [x] 4.3 Support `--json` raw output for both verbs, consistent with other subcommands
- [x] 4.4 Report success as resolved / open after the call
- [x] 4.5 Add `bitbucket.test.ts` cases for resolve, reopen, the missing-id error, and `--json`

## 5. Rendering resolution state

- [x] 5.1 Update `formatCommentList` (and single-comment rendering) in `bitbucket/lib/formatters.ts` to mark resolved threads and distinguish them from open ones, annotating resolver/timestamp when present
- [x] 5.2 Add `formatters.test.ts` cases covering a resolved comment and an open comment

## 6. Help and docs

- [x] 6.1 Add the new `comment resolve` / `comment reopen` subcommands to the `af bb` help text in `commands/bitbucket.ts`
- [x] 6.2 Update the Bitbucket command reference in `CLAUDE.md`

## 7. Verify

- [x] 7.1 Run `bun run test`, `bun run lint:check`, `bun run format:check`, and `bun run spell:check`
- [ ] 7.2 Smoke-test `af bb pr comment list/get` (resolution shown) and `resolve`/`reopen` against the live test PR _(deferred: needs live Bitbucket access)_
