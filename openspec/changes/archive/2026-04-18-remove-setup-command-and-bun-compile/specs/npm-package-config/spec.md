## MODIFIED Requirements

### Requirement: Files whitelist

The `package.json` MUST include a `files` field that limits the published package to only the files needed to run the CLI.

#### Scenario: Package is published

- **WHEN** `npm pack` or `npm publish` is run
- **THEN** only source directories (`commands/`, `components/`, `utils/`, `resources/`), entry points (`main.ts`, `router.ts`, `af`), and metadata (`LICENSE`, `README.md`) are included
- **AND** tests, openspec, dist, vscode-extension, setup, generated, Jenkinsfile, and dev config are excluded
