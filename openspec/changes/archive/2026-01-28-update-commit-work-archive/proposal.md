# Update Commit Work to Archive Spec

## Why

The `/commit-work` command commits changes but does not archive the associated OpenSpec. Users must remember to run `/spec-archive` separately or use `/complete-work`. This creates friction and risks forgetting to archive the spec after implementation is complete.

## What Changes

- The `/commit-work` command will check if the OpenSpec change directory still exists (i.e., hasn't been archived)
- If the change exists, it will archive it using `openspec archive <id> --yes` before committing
- The commit message will continue to use the proposal title and ID as before

## Impact

- Affected specs: commit-work-command (new capability)
- Affected code: `setup/.claude/commands/commit-work.md`
