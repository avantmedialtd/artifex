# Tasks: Add SonarQube Support

## 1. Configuration and properties parsing

- [x] 1.1 Create `sonar/lib/properties.ts` with a `findProperties(startDir)` walk-up helper and a `parseProperties(contents)` parser that ignores blank lines and `#` comments, splits on the first `=`, and trims values
- [x] 1.2 Add unit tests for `properties.ts` covering: file found in cwd, file found in parent dir, file missing, comments/blank-line handling, duplicate keys (last wins)
- [x] 1.3 Create `sonar/lib/config.ts` exporting `getSonarConfig({ projectFlag })` that resolves `baseUrl` (env → properties), `projectKey` (flag → properties), and `token` (env only)
- [x] 1.4 Make `getSonarConfig` throw clear, named errors when `SONAR_TOKEN`, base URL, or project key cannot be resolved — error messages must name what was checked
- [x] 1.5 Add unit tests for `config.ts` covering each resolution branch and each missing-config error

## 2. HTTP client and types

- [x] 2.1 Create `sonar/lib/types.ts` with response type definitions for `qualitygates/project_status`, `issues/search`, `measures/component`, and `project_pull_requests/list`
- [x] 2.2 Create `sonar/lib/request.ts` exporting `request<T>(config, path, query)` that sets `Authorization: Bearer <token>`, normalizes trailing slashes, and builds the query string
- [x] 2.3 Implement error mapping in `request.ts`: 401/403 → `SonarAuthError`, 404 on `project_status` with `pullRequest` → `SonarPRNotAnalyzedError`, 404 on project lookup → `SonarProjectNotFoundError`, other non-2xx → `SonarRequestError`
- [x] 2.4 Add unit tests for `request.ts` using a mocked `fetch` covering each error mapping and successful JSON parse
- [x] 2.5 Create `sonar/lib/client.ts` exposing `getQualityGate({ pullRequest? })`, `getIssues({ pullRequest?, page?, pageSize? })`, `getMeasures({ pullRequest?, metricKeys })`, and `listPullRequests()` — each calls `request()` with the right path and params
- [x] 2.6 Add unit tests for `client.ts` verifying each function builds the correct URL and forwards parameters

## 3. Bitbucket PR auto-detection

- [x] 3.1 Identify the existing function in `bitbucket/lib/` that lists open PRs filtered by branch; if a suitable export is missing, add a minimal `findOpenPullRequestsForBranch(branch)` helper that wraps the existing list logic
- [x] 3.2 Create a thin adapter in `commands/sonar.ts` (or `sonar/lib/pr-detect.ts`) that gets the current branch via `git rev-parse --abbrev-ref HEAD`, calls the Bitbucket helper, and returns a result discriminating between `single`, `none`, and `ambiguous`
- [x] 3.3 Map "Bitbucket credentials missing" to a Sonar-specific error message that names `BITBUCKET_API_TOKEN` and suggests passing the PR id explicitly
- [x] 3.4 Add unit tests for the adapter with the Bitbucket client mocked: 0 / 1 / many PRs, missing credentials, non-zero git exit

## 4. Formatters

- [x] 4.1 Create `sonar/lib/formatters.ts` with `formatGateSummary(gate)` rendering pass/fail headline and per-condition lines (using existing `utils/output.ts` color helpers)
- [x] 4.2 Add `formatTopIssues(issues, limit)` truncating to `limit` after sorting by severity descending, with a "N more" hint when truncated
- [x] 4.3 Add `formatIssuesList(issues)` for the full `--issues` view, columns: type · severity · file:line · message
- [x] 4.4 Add `formatMeasures(measures)` extracting coverage and duplications from the response and rendering them as a short block
- [x] 4.5 Add `formatPrList(prs)` rendering id, title, branch, gate status, and analysis date as a table
- [x] 4.6 Add `buildDashboardUrl(baseUrl, projectKey, pullRequest?)` for the trailing link line
- [x] 4.7 Add unit tests for each formatter using fixture API responses

## 5. Command handler

- [x] 5.1 Create `commands/sonar.ts` with a top-level handler that parses `--json`, `--project`, `--issues`, and the subcommand argv
- [x] 5.2 Implement `af sonar` (no subcommand) printing sonar-specific help text
- [x] 5.3 Implement `af sonar pr [id]` — resolves config, resolves PR id (explicit or via auto-detect), runs the three API calls in parallel, prints the combined view, and returns a non-zero exit code when the gate fails
- [x] 5.4 Implement `af sonar pr [id] --issues` — same as 5.3 but renders the full issues list instead of the truncated top-N block
- [x] 5.5 Implement `af sonar gate` — calls `getQualityGate()` with no PR scope, renders the gate summary, returns non-zero on `ERROR`
- [x] 5.6 Implement `af sonar prs` — calls `listPullRequests()` and renders the table
- [x] 5.7 Implement `--json` mode for each subcommand: aggregate response object for `pr`, raw response for `gate` and `prs`; suppress all human-readable output on stdout
- [x] 5.8 Add unit tests for `commands/sonar.ts` covering argument parsing, dispatch, and exit codes (client mocked)

## 6. Router and help wiring

- [x] 6.1 Add `sonar` dispatch in `router.ts` delegating to `commands/sonar.ts`
- [x] 6.2 Add a `sonar` entry to `commands/help.ts` describing the command group
- [x] 6.3 Add an integration test that runs `af sonar` and asserts the help output mentions `pr`, `gate`, and `prs`

## 7. Packaging

- [x] 7.1 Add `sonar/**/*.ts` to the `files` array in `package.json`
- [x] 7.2 Run `npm pack --dry-run` and verify the output includes `sonar/lib/` sources

## 8. Documentation

- [x] 8.1 Add a `### SonarQube Command` section to `CLAUDE.md` after the Bitbucket section, documenting env vars, properties-file resolution, the four subcommands, and the deferred follow-ups
- [x] 8.2 Update `README.md` if it enumerates available commands
