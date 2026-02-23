## MODIFIED Requirements

### Requirement: Installation instructions

The README MUST provide clear installation instructions appropriate for the project's current distribution method.

#### Scenario: User installs from NPM

- **GIVEN** a user wants to install Artifex
- **WHEN** they read the installation section
- **THEN** they find `npm install -g @avantmedia/af` as the primary installation method
- **AND** they understand that Bun is a prerequisite

#### Scenario: Developer installs from source

- **GIVEN** a developer has cloned the repository
- **WHEN** they read the installation section
- **THEN** they find instructions for using `bun link` to install from source
- **AND** they understand this is for development purposes

#### Scenario: User checks system requirements

- **GIVEN** a user wants to know if they can run Artifex
- **WHEN** they read the installation section
- **THEN** they find Bun listed as a runtime requirement
- **AND** they understand the supported platforms

### Requirement: Contact and contribution information

The README MUST provide information on how to get help, report issues, and contribute to the project.

#### Scenario: User checks the license

- **GIVEN** a user wants to understand the project's license
- **WHEN** they read the license section of the README
- **THEN** they see it is MIT licensed
- **AND** they find a link to the full LICENSE file
