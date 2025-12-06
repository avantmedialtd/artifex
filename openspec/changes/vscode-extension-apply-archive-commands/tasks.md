# Tasks

## Implementation

- [ ] Update `contextValue` in `taskProvider.ts` to encode completion status
- [ ] Add `applyChange` command registration in `extension.ts`
- [ ] Add `archiveChange` command registration in `extension.ts`
- [ ] Create helper function to execute zap commands via Task API
- [ ] Add context menu entries to `package.json` with `when` clauses
- [ ] Update existing Copy Title/Copy Change ID `when` clauses for new contextValue scheme

## Testing

- [ ] Test Apply command appears only for changes with incomplete tasks
- [ ] Test Archive command appears only for changes with all tasks complete
- [ ] Test Apply command executes `zap apply <change-id>` in terminal
- [ ] Test Archive command executes `zap archive <change-id>` in terminal
- [ ] Test terminal auto-closes on successful command execution
- [ ] Test existing Copy Title and Copy Change ID commands still work
