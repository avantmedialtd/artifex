## 1. License

- [x] 1.1 Replace `LICENSE` file content with MIT license (Copyright Avant Media LTD)
- [x] 1.2 Change `license` field in `package.json` from `"UNLICENSED"` to `"MIT"`

## 2. Package metadata

- [x] 2.1 Change `name` field in `package.json` to `"@avantmedia/af"`
- [x] 2.2 Add `files` field to `package.json` with: `commands/`, `components/`, `utils/`, `generated/`, `setup/`, `resources/`, `main.ts`, `router.ts`, `af`
- [x] 2.3 Add `keywords` array to `package.json`
- [x] 2.4 Move `react-devtools-core` from `dependencies` to `devDependencies`

## 3. Remove zap alias

- [x] 3.1 Delete the root `zap` file
- [x] 3.2 Remove `"zap"` entry from `bin` field in `package.json`

## 4. Documentation

- [x] 4.1 Update README installation section: add `npm install -g @avantmedia/af` as primary method, note Bun prerequisite
- [x] 4.2 Update README license section from proprietary to MIT
- [x] 4.3 Remove references to `zap` from README

## 5. Verification

- [x] 5.1 Run `npm pack` and verify only expected files are included
- [x] 5.2 Run `bun link` and verify `af` command works locally
