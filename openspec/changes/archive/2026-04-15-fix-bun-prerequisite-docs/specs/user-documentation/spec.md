## MODIFIED Requirements

### Requirement: Installation instructions

The README MUST provide clear installation instructions appropriate for the project's current distribution method.

#### Scenario: User installs from NPM

- **GIVEN** a user wants to install Artifex
- **WHEN** they read the installation section
- **THEN** they find `npm install -g @avantmedia/af` as the primary installation method
- **AND** they understand that Node.js (version 16 or higher) is the only runtime prerequisite
- **AND** they understand that the Bun runtime ships as a bundled dependency and is installed automatically by npm

#### Scenario: Developer installs from source

- **GIVEN** a developer has cloned the repository
- **WHEN** they read the installation section
- **THEN** they find instructions for using `bun link` to install from source
- **AND** they understand this is for development purposes
- **AND** they understand that Bun must be installed locally for the contributor workflow (running tests, formatting, compiling)

#### Scenario: User checks system requirements

- **GIVEN** a user wants to know if they can run Artifex
- **WHEN** they read the installation section
- **THEN** they find Node.js (version 16 or higher) listed as the runtime requirement
- **AND** they understand that Bun does not need to be installed separately when using the npm package
- **AND** they understand the supported platforms
