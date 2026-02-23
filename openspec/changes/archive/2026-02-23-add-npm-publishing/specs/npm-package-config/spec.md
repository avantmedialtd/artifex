## ADDED Requirements

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
- **THEN** only source directories (`commands/`, `components/`, `utils/`, `generated/`, `setup/`, `resources/`), entry points (`main.ts`, `router.ts`, `af`), and metadata (`LICENSE`, `README.md`) are included
- **AND** tests, openspec, dist, vscode-extension, Jenkinsfile, and dev config are excluded

### Requirement: Keywords for discoverability

The `package.json` MUST include a `keywords` array to improve discoverability on the NPM registry.

#### Scenario: User searches NPM

- **WHEN** a user searches for related terms on npmjs.com
- **THEN** the package has relevant keywords that help it appear in search results

### Requirement: Production dependencies are correct

The `package.json` MUST only list runtime dependencies in `dependencies`. Development-only packages MUST be in `devDependencies`.

#### Scenario: react-devtools-core is a dev dependency

- **WHEN** the published package is inspected
- **THEN** `react-devtools-core` is in `devDependencies`, not `dependencies`
- **AND** only `ink` and `react` remain in `dependencies`
