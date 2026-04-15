## REMOVED Requirements

### Requirement: Install Extension Command
**Reason**: The OpenSpec Tasks VSCode extension is now distributed via the VSCode Marketplace, so `af` no longer ships the extension or provides a command to install it. The command is also already non-functional in practice because no `.vsix` file is bundled in the binary.
**Migration**: Install the OpenSpec Tasks extension from the VSCode Marketplace instead — open VSCode, search for "OpenSpec Tasks" in the Extensions view, and install it from there.

The CLI SHALL provide an `install-extension` command that installs the bundled VSCode extension.

#### Scenario: Successful installation

- **WHEN** user runs `af install-extension`
- **AND** VSCode CLI (`code`) is available
- **THEN** the OpenSpec extension is installed to VSCode
- **AND** a success message is displayed

#### Scenario: VSCode CLI not available

- **WHEN** user runs `af install-extension`
- **AND** VSCode CLI (`code`) is not found
- **THEN** an error message is displayed explaining VSCode must be installed
- **AND** the command exits with code 1

### Requirement: Embedded VSIX File
**Reason**: The extension is no longer bundled in the `af` binary; users install it from the VSCode Marketplace directly, so there is no VSIX to embed.
**Migration**: Install the extension from the VSCode Marketplace.

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
**Reason**: The command that created temp files has been removed; there is nothing left to clean up.
**Migration**: No user action needed — the command no longer exists.

The command SHALL clean up temporary files after installation.

#### Scenario: Successful cleanup

- **WHEN** extension installation completes (success or failure)
- **THEN** any temporary VSIX file is deleted
- **AND** no orphaned files remain

### Requirement: Installation Feedback
**Reason**: The command providing this feedback has been removed. Installation feedback is now provided by VSCode itself when installing from the Marketplace.
**Migration**: Install the extension from the VSCode Marketplace; VSCode's own UI shows installation progress and results.

The command SHALL provide clear feedback during installation.

#### Scenario: Installation progress

- **WHEN** user runs `af install-extension`
- **THEN** status messages indicate installation is in progress
- **AND** the final result (success/failure) is clearly displayed

#### Scenario: Installation failure

- **WHEN** `code --install-extension` fails
- **THEN** the error output from VSCode CLI is displayed
- **AND** the command exits with code 1
