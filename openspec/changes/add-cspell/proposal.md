# Proposal: Add CSpell for spell checking

## Why

The project currently lacks spell checking capabilities, which can lead to typos in code comments, documentation, and user-facing messages. Adding CSpell will maintain high quality standards and catch spelling issues early in the development workflow.

## What Changes

- Install CSpell as a devDependency
- Create `.cspell.json` configuration file with custom dictionary support
- Add `npm run spell:check` command to check spelling
- Integrate spell checking into CI pipeline (new Jenkinsfile stage)
- Add CSpell VSCode extension to recommendations
- Update CLAUDE.md and project.md documentation
- Create new `spell-checking` capability specification

## Impact

- Affected specs: Creates new `spell-checking` capability
- Affected code:
  - `package.json` - Add CSpell dependency and npm script
  - `.cspell.json` - New configuration file
  - `Jenkinsfile` - Add spell check stage
  - `.vscode/extensions.json` - Add extension recommendation
  - `CLAUDE.md` - Document spell checking
  - `openspec/project.md` - Document spell checking conventions
