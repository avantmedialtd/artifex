## 1. Remove af CLI Dependencies

- [x] 1.1 Delete `applyChange` command registration from `extension.ts` (lines 201-220)
- [x] 1.2 Delete `archiveChange` command registration from `extension.ts` (lines 222-241)
- [x] 1.3 Delete `executeZapCommand` function from `extension.ts` (lines 319-357)
- [x] 1.4 Remove `openspec.applyChange` and `openspec.archiveChange` from `contributes.commands` in `package.json`
- [x] 1.5 Remove apply/archive entries from `contributes.menus.view/item/context` in `package.json`

## 2. Add Marketplace Metadata

- [x] 2.1 Add `@vscode/vsce` as a devDependency in `package.json`
- [x] 2.2 Add `"publish"` script (`vsce publish`) to `package.json`
- [x] 2.3 Add `keywords` array to `package.json`
- [x] 2.4 Remove `install-extension` script from `package.json`

## 3. Update Packaging Files

- [x] 3.1 Add `*.vsix` to `.vscodeignore`
- [x] 3.2 Create `CHANGELOG.md` with 0.1.0 initial release notes

## 4. Update README for Marketplace

- [x] 4.1 Remove `af spec archive` and `af spec apply` CLI examples from README
- [x] 4.2 Remove "Known Limitations" about single workspace support (already supported)
- [x] 4.3 Remove "Multi-workspace support" from "Future Enhancements" (already done)
- [x] 4.4 Remove "Development" and "Manual Installation" sections

## 5. Verify

- [x] 5.1 Run `npm run compile` — no TypeScript errors
- [x] 5.2 Run `npx @vscode/vsce package` — produces `.vsix` without errors
- [x] 5.3 Verify no remaining `af` references in source and README
