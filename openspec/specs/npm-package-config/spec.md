# npm-package-config Specification

## Purpose

Defines the NPM package configuration for publishing Artifex to the public registry as `@avantmedia/af`.
## Requirements
### Requirement: Scoped package name

The package MUST be published under the `@avantmedia/af` scoped name on the public NPM registry.

#### Scenario: Package is published to NPM

- **WHEN** the package is published
- **THEN** it is available at `@avantmedia/af` on the public NPM registry
- **AND** it uses `--access public` since scoped packages default to private

### Requirement: MIT license

The package MUST use the MIT license for open-source distribution.

#### Scenario: License field and file are consistent

- **WHEN** a user inspects the published package
- **THEN** `package.json` has `"license": "MIT"`
- **AND** a `LICENSE` file with the MIT license text is included
- **AND** the copyright holder is Avant Media LTD

### Requirement: Files whitelist

The `package.json` MUST include a `files` field that limits the published package to only the files needed to run the CLI.

#### Scenario: Package is published

- **WHEN** `npm pack` or `npm publish` is run
- **THEN** only source directories (`commands/`, `components/`, `utils/`, `resources/`), entry points (`main.ts`, `router.ts`, `af`), and metadata (`LICENSE`, `README.md`) are included
- **AND** tests, openspec, dist, vscode-extension, setup, generated, Jenkinsfile, and dev config are excluded

### Requirement: Keywords for discoverability

The `package.json` MUST include a `keywords` array to improve discoverability on the NPM registry.

#### Scenario: User searches NPM

- **WHEN** a user searches for related terms on npmjs.com
- **THEN** the package has relevant keywords that help it appear in search results

### Requirement: Production dependencies are correct

The `package.json` MUST only list runtime dependencies in `dependencies`. Development-only packages MUST be in `devDependencies`. The `bun` package MUST be included as a runtime dependency to provide the Bun runtime for TypeScript execution.

#### Scenario: react-devtools-core is a dev dependency

- **WHEN** the published package is inspected
- **THEN** `react-devtools-core` is in `devDependencies`, not `dependencies`

#### Scenario: bun is a runtime dependency

- **WHEN** the published package is inspected
- **THEN** `bun` is in `dependencies`
- **AND** `ink` and `react` remain in `dependencies`

### Requirement: Node.js engine requirement

The `package.json` MUST specify a minimum Node.js version of 16 or higher in the `engines` field, since the wrapper only requires basic Node.js features (`child_process.spawn`, `require.resolve`).

#### Scenario: User installs with Node.js 16+

- **GIVEN** the user has Node.js 16 or higher installed
- **WHEN** they run `npm install -g @avantmedia/af`
- **THEN** npm does not emit engine compatibility warnings
- **AND** the wrapper script executes successfully

