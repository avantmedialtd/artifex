# Tasks

## Implementation

- [x] Update `contextValue` in `taskProvider.ts` to encode completion status
- [x] Add `applyChange` command registration in `extension.ts`
- [x] Add `archiveChange` command registration in `extension.ts`
- [x] Create helper function to execute zap commands via Task API
- [x] Add context menu entries to `package.json` with `when` clauses
- [x] Update existing Copy Title/Copy Change ID `when` clauses for new contextValue scheme

## Testing

- [x] Test Apply command appears only for changes with incomplete tasks
- [x] Test Archive command appears only for changes with all tasks complete
- [x] Test Apply command executes `zap apply <change-id>` in terminal
- [x] Test Archive command executes `zap archive <change-id>` in terminal
- [x] Test terminal auto-closes on successful command execution
- [x] Test existing Copy Title and Copy Change ID commands still work
