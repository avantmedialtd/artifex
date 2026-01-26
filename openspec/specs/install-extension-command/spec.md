# install-extension-command Specification

## Purpose
TBD - created by archiving change add-install-extension-command. Update Purpose after archive.
## Requirements
### Requirement: Install Extension Command

The CLI SHALL provide an `install-extension` command that installs the bundled VSCode extension.

#### Scenario: Successful installation

- **WHEN** user runs `af install-extension`
- **AND** VSCode CLI (`code`) is available
- **THEN** the OpenSpec Tasks extension is installed to VSCode
- **AND** a success message is displayed

#### Scenario: VSCode CLI not available

- **WHEN** user runs `af install-extension`
- **AND** VSCode CLI (`code`) is not found
- **THEN** an error message is displayed explaining VSCode must be installed
- **AND** the command exits with code 1

### Requirement: Embedded VSIX File

The VSIX file SHALL be embedded in the compiled binary and accessible without external files.

#### Scenario: Compiled binary execution

- **WHEN** the compiled binary is executed with `af install-extension`
- **THEN** the extension is installed from the embedded VSIX
- **AND** behavior is identical to development mode

#### Scenario: Development mode execution

- **WHEN** the command is executed from source (`./af install-extension`)
- **THEN** the extension is installed from the file system
- **AND** no compilation is required

### Requirement: Temp File Cleanup

The command SHALL clean up temporary files after installation.

#### Scenario: Successful cleanup

- **WHEN** extension installation completes (success or failure)
- **THEN** any temporary VSIX file is deleted
- **AND** no orphaned files remain

### Requirement: Installation Feedback

The command SHALL provide clear feedback during installation.

#### Scenario: Installation progress

- **WHEN** user runs `af install-extension`
- **THEN** status messages indicate installation is in progress
- **AND** the final result (success/failure) is clearly displayed

#### Scenario: Installation failure

- **WHEN** `code --install-extension` fails
- **THEN** the error output from VSCode CLI is displayed
- **AND** the command exits with code 1

