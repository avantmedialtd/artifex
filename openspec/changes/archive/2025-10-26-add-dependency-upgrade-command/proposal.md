# Proposal: Add Dependency Upgrade Command

## Summary

Add a `zap npm upgrade` command that automatically upgrades all npm dependencies (both dependencies and devDependencies) in package.json to their latest versions, preserving existing version range symbols (^, ~, etc.), and automatically runs `npm install` to apply the changes.

## Motivation

Keeping dependencies up-to-date is a common development task that requires:

1. Checking npm registry for latest versions of each package
2. Manually updating version numbers in package.json
3. Running npm install to update package-lock.json and node_modules

This repetitive process is error-prone and time-consuming. A single command that automates this workflow will significantly improve developer productivity.

## Scope

This change introduces one new capability:

- **dependency-upgrade**: Command-line interface to upgrade package.json dependencies

## User Impact

Developers using zap will be able to:

- Run `zap npm upgrade` to upgrade all dependencies to latest versions
- See clear output showing which packages were upgraded
- Automatically have changes applied via npm install

## Success Criteria

- `zap npm upgrade` command successfully upgrades all dependencies and devDependencies
- Version range symbols (^, ~) are preserved with updated version numbers
- npm install runs automatically after package.json is updated
- Clear console output shows upgrade progress and results
- Works with standard npm package.json structure

## Related Changes

None - this is a standalone feature addition.

## Timeline

Implementation can proceed immediately upon approval. No dependencies on other work.
