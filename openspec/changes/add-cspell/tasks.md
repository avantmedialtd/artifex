# Implementation Tasks

## Overview

This task list implements CSpell spell checking following the same patterns as existing quality tools (Prettier, OXLint).

## Tasks

### 1. Install CSpell package

- [x] Install `cspell` as a devDependency
- [x] Verify installation with `npx cspell --version`
- [x] Commit package.json and package-lock.json changes

**Validation**: `npm ls cspell` shows the installed version

**Dependencies**: None

### 2. Create CSpell configuration file

- [x] Create `.cspell.json` at project root
- [x] Configure file patterns to check (TypeScript, JavaScript, Markdown, JSON)
- [x] Configure ignore patterns (node_modules, .git, package-lock.json, build outputs)
- [x] Set language to English (US)
- [x] Initialize empty custom dictionary array

**Validation**: Configuration file is valid JSON and loads without errors

**Dependencies**: Task 1 (CSpell installed)

### 3. Add npm script for spell checking

- [x] Add `spell:check` script to package.json: `cspell "**"`
- [x] Verify the command runs successfully
- [x] Test that it respects ignore patterns

**Validation**: `npm run spell:check` executes and completes

**Dependencies**: Tasks 1-2

### 4. Fix existing spelling issues

- [x] Run `npm run spell:check` on current codebase
- [x] For each violation:
    - [x] Fix genuine typos in code, comments, and documentation
    - [x] Add legitimate technical terms to custom dictionary in `.cspell.json`
- [x] Re-run until clean

**Validation**: `npm run spell:check` exits with code 0 (no violations)

**Dependencies**: Tasks 1-3

### 5. Add VSCode extension recommendation

- [x] Update `.vscode/extensions.json`
- [x] Add `"streetsidesoftware.code-spell-checker"` to recommendations array
- [x] Maintain alphabetical order if multiple extensions exist

**Validation**: VSCode prompts to install extension when opening project

**Dependencies**: None (can be done in parallel with other tasks)

### 6. Integrate into CI pipeline

- [x] Update `Jenkinsfile`
- [x] Add new `spell` stage after the `format` stage
- [x] Run `npm run spell:check` in the spell stage
- [x] Ensure stage fails on non-zero exit code

**Validation**: Jenkins runs spell check stage and fails if violations exist

**Dependencies**: Tasks 1-4 (codebase must be clean before CI enforcement)

### 7. Update project documentation

- [x] Update `CLAUDE.md`:
    - [x] Add CSpell to tech stack section
    - [x] Add spell:check command to Development Commands section
    - [x] Document that spell checking is enforced in CI
- [x] Update `openspec/project.md`:
    - [x] Add CSpell to Tech Stack section
    - [x] Add spell checking to Code Quality conventions
    - [x] Document spell:check command availability

**Validation**: Both documentation files mention CSpell and spell:check

**Dependencies**: Tasks 1-6 (document after implementation is complete)

### 8. Verify end-to-end integration

- [x] Run all quality checks in sequence: `npm run lint && npm run format:check && npm run spell:check`
- [x] Verify all checks pass
- [x] Verify CI pipeline runs successfully with all stages
- [x] Test that CI fails if a spelling error is introduced

**Validation**: Full quality check suite passes both locally and in CI

**Dependencies**: Tasks 1-7 (final verification of complete implementation)

## Notes

- Tasks 2-4 are sequential and must be completed in order
- Task 5 can be done in parallel with tasks 2-4
- Tasks 6-7 should be done after the codebase is clean (task 4 complete)
- Task 8 is final verification

## Estimated Effort

- Total time: 1-2 hours
- Most time will be spent on task 4 (fixing existing spelling issues)
- Remaining tasks are straightforward following established patterns
