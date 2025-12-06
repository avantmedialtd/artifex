## 1. Implementation

- [x] 1.1 Update `taskProvider.ts` to remove copy title click action from change items
- [x] 1.2 Update `taskProvider.ts` to add click action that opens `proposal.md`
- [x] 1.3 Add `openspecTasks.openProposal` command in `extension.ts`
- [x] 1.4 Add "Copy Title" context menu item in `package.json` for change items
- [x] 1.5 Update context menu command handler to support copying title

## 2. Testing

- [x] 2.1 Verify clicking change item opens proposal.md
- [x] 2.2 Verify right-click shows both "Copy Change ID" and "Copy Title"
- [x] 2.3 Verify "Copy Title" copies the title to clipboard
- [x] 2.4 Verify existing "Copy Change ID" still works
