# user-documentation Specification

## Purpose

TBD - created by archiving change 2025-10-26-add-user-friendly-readme. Update Purpose after archive.

## Requirements

### Requirement: README.md file exists at project root

The project MUST provide a README.md file at the root directory that serves as the primary user-facing documentation.

#### Scenario: User visits the repository

- **GIVEN** a user browses the repository on GitHub or clones it locally
- **WHEN** they look at the root directory
- **THEN** a README.md file is present
- **AND** it is immediately visible as the default rendered file

#### Scenario: Developer explores project locally

- **GIVEN** a developer has cloned the repository
- **WHEN** they list files in the root directory
- **THEN** README.md is present alongside other root-level files
- **AND** it can be opened with any text editor or markdown viewer

### Requirement: Project description and purpose

The README MUST clearly explain what Zap is, its purpose, and why users should consider using it.

#### Scenario: First-time visitor wants to understand the project

- **GIVEN** a user opens the README
- **WHEN** they read the initial sections
- **THEN** they can quickly understand that Zap is a CLI development utility
- **AND** they learn what problems it solves for developers
- **AND** they understand the project's current maturity level

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

### Requirement: Usage examples and available commands

Documentation MUST include command shortcuts where they exist to help users discover the most ergonomic command forms.

#### Scenario: Developer wants to know about propose command options

- **GIVEN** the README.md file is open
- **WHEN** the developer reads the "Available Commands" section
- **THEN** they see both `zap propose <proposal-text>` and `zap spec propose <proposal-text>` listed
- **AND** the documentation indicates they are equivalent
- **AND** the shorthand `zap propose` is presented as the preferred form for brevity

### Requirement: Development setup instructions

The README MUST include instructions for contributors who want to work on Zap itself.

#### Scenario: Contributor wants to set up development environment

- **GIVEN** a contributor has cloned the repository
- **WHEN** they read the development section
- **THEN** they find instructions for installing dependencies
- **AND** they learn how to run tests
- **AND** they learn how to run the linter
- **AND** they can successfully set up a working development environment

#### Scenario: Contributor wants to test changes locally

- **GIVEN** a contributor is making changes to Zap
- **WHEN** they read the development section
- **THEN** they find instructions for linking the package locally
- **AND** they understand how to test their changes before submitting

### Requirement: Project status and maturity indicator

The README MUST clearly indicate the project's current development status to set appropriate expectations.

#### Scenario: User evaluates project for production use

- **GIVEN** a user is considering using Zap in their workflow
- **WHEN** they read the README
- **THEN** they find a clear indicator of the project's maturity (e.g., early stage, beta, stable)
- **AND** they can make an informed decision about adoption
- **AND** they understand what level of stability and support to expect

### Requirement: Human-friendly and welcoming tone

The README MUST be written in clear, accessible language that is welcoming to developers of all experience levels.

#### Scenario: Junior developer reads the README

- **GIVEN** a less experienced developer discovers the project
- **WHEN** they read the README
- **THEN** the language is clear and jargon is explained when necessary
- **AND** they feel welcomed to try the tool or contribute
- **AND** they are not intimidated by overly technical language

#### Scenario: README uses consistent formatting

- **GIVEN** a user reads through the entire README
- **WHEN** they navigate between sections
- **THEN** the formatting is consistent throughout
- **AND** code examples are properly formatted in code blocks
- **AND** commands are clearly distinguished from explanatory text

### Requirement: Contact and contribution information

The README MUST provide information on how to get help, report issues, and contribute to the project.

#### Scenario: User encounters a bug

- **GIVEN** a user finds a problem while using Zap
- **WHEN** they look for how to report it in the README
- **THEN** they find a link to the GitHub issues page
- **AND** they understand the appropriate way to report problems

#### Scenario: Developer wants to contribute

- **GIVEN** a developer wants to contribute to Zap
- **WHEN** they read the README
- **THEN** they find information about how contributions are managed
- **AND** they understand where to find contribution guidelines if they exist
- **AND** they feel encouraged to participate

#### Scenario: User checks the license

- **GIVEN** a user wants to understand the project's license
- **WHEN** they read the license section of the README
- **THEN** they see it is MIT licensed
- **AND** they find a link to the full LICENSE file
