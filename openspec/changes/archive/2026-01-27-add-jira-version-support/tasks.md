# Tasks: Add Jira Version Support

## 1. Types and API Client

- [x] 1.1 Add `JiraVersion` interface to `jira/lib/types.ts`
- [x] 1.2 Add version fields to `JiraIssueFields` interface (fixVersions, affectedVersions)
- [x] 1.3 Add `JiraCreateVersionRequest` and `JiraUpdateVersionRequest` interfaces
- [x] 1.4 Add `--fix-version` and `--affected-version` to `CommandOptions` interface
- [x] 1.5 Implement `getProjectVersions(projectKey)` in `jira/lib/client.ts`
- [x] 1.6 Implement `getVersion(versionId)` in `jira/lib/client.ts`
- [x] 1.7 Implement `createVersion(...)` in `jira/lib/client.ts`
- [x] 1.8 Implement `updateVersion(versionId, updates)` in `jira/lib/client.ts`
- [x] 1.9 Implement `deleteVersion(versionId)` in `jira/lib/client.ts`
- [x] 1.10 Update `createIssue()` to accept `fixVersions` and `affectedVersions` parameters
- [x] 1.11 Update `updateIssue()` to accept `fixVersions` and `affectedVersions` parameters

## 2. Formatters

- [x] 2.1 Add `formatVersions(projectKey, versions)` to `jira/lib/formatters.ts`
- [x] 2.2 Add `formatVersion(version)` to `jira/lib/formatters.ts`
- [x] 2.3 Update `formatIssue()` to display fix versions and affected versions

## 3. Command Handler

- [x] 3.1 Add `--fix-version` and `--affected-version` options to argument parser
- [x] 3.2 Add `versions <project>` subcommand handler
- [x] 3.3 Add `version <version-id>` subcommand handler
- [x] 3.4 Add `version-create` subcommand handler with options
- [x] 3.5 Add `version-update <version-id>` subcommand handler
- [x] 3.6 Add `version-delete <version-id>` subcommand handler
- [x] 3.7 Update `create` subcommand to pass fix/affected versions
- [x] 3.8 Update `update` subcommand to pass fix/affected versions
- [x] 3.9 Update `showJiraHelp()` with version commands and options

## 4. Testing

- [x] 4.1 Add unit tests for version client functions (N/A - no existing Jira tests)
- [x] 4.2 Add unit tests for version formatter functions (N/A - no existing Jira tests)
- [x] 4.3 Add integration tests for version commands (N/A - no existing Jira tests)
