## MODIFIED Requirements

### Requirement: Embedded VSIX File

The VSIX file SHALL be embedded in the compiled binary and accessible without external files.

#### Scenario: Compiled binary execution

- **WHEN** the compiled binary is executed with `af install-extension`
- **THEN** the extension is installed from the embedded VSIX named `openspec-*.vsix`
- **AND** behavior is identical to development mode

#### Scenario: Development mode execution

- **WHEN** the command is executed from source (`./af install-extension`)
- **THEN** the extension is installed from the file system at `vscode-extension/openspec-*.vsix`
- **AND** no compilation is required

### Requirement: Installation Feedback

The command SHALL provide clear feedback during installation.

#### Scenario: Installation progress

- **WHEN** user runs `af install-extension`
- **THEN** status messages indicate the OpenSpec extension installation is in progress
- **AND** the final result (success/failure) is clearly displayed
