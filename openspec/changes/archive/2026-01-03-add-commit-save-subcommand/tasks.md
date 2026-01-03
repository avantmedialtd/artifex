# Tasks

## Implementation

- [x] Add `handleCommitSave` function in `commands/spec.ts` that:
  - Validates the message argument is provided
  - Parses remaining arguments for `Key=Value` trailer pairs
  - Runs `git add .` to stage all changes
  - Builds commit command with message and any `--trailer "Key: Value"` flags
  - Returns appropriate exit codes

- [x] Update `router.ts` to route `commit save` subcommand to the new handler

- [x] Update `commands/help.ts`:
  - Add `commit save` entry to `HELP_CONTENT`
  - Add `commit save` line in `showGeneralHelp`

## Validation

- [x] Manual testing:
  - `af commit save "test message"` creates commit
  - `af commit save "test message" Issue=PROJ-123` creates commit with Issue trailer
  - `af commit save "test" Issue=PROJ-123 Reviewed-by=alice` creates commit with multiple trailers
  - `af commit save` without message shows error
  - `af help commit` shows updated help
