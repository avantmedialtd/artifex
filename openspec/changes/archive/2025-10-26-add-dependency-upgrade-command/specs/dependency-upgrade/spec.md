# dependency-upgrade Specification

## Purpose

Enable developers to quickly upgrade all npm dependencies to their latest versions via a single command, automating the tedious process of checking and updating package versions.

## ADDED Requirements

### Requirement: NPM upgrade command invocation

The zap CLI MUST recognize and execute the `npm upgrade` command.

#### Scenario: Developer runs zap npm upgrade

- **GIVEN** a developer is in a directory with a package.json file
- **WHEN** they execute `zap npm upgrade` in their terminal
- **THEN** the npm upgrade command is invoked
- **AND** the dependency upgrade process begins

#### Scenario: Invalid subcommand

- **GIVEN** a developer runs zap with an unrecognized subcommand
- **WHEN** the command is executed
- **THEN** an error message is displayed
- **AND** the process exits with a non-zero exit code

### Requirement: Package.json detection

The command MUST locate and read package.json from the current working directory.

#### Scenario: Package.json exists in current directory

- **GIVEN** a valid package.json file exists in the current working directory
- **WHEN** `zap npm upgrade` is executed
- **THEN** the file is successfully read and parsed
- **AND** the upgrade process continues with the parsed dependency list

#### Scenario: Package.json is missing

- **GIVEN** no package.json file exists in the current working directory
- **WHEN** `zap npm upgrade` is executed
- **THEN** a clear error message is displayed indicating package.json was not found
- **AND** the process exits with a non-zero exit code
- **AND** no files are modified

#### Scenario: Package.json is invalid JSON

- **GIVEN** package.json exists but contains invalid JSON
- **WHEN** `zap npm upgrade` is executed
- **THEN** a clear error message is displayed indicating the JSON parsing error
- **AND** the process exits with a non-zero exit code
- **AND** no files are modified

### Requirement: Fetch latest versions from npm registry

The command MUST query the npm registry to determine the latest version for each dependency.

#### Scenario: All packages have newer versions available

- **GIVEN** package.json contains dependencies that have newer versions in npm registry
- **WHEN** `zap npm upgrade` queries the registry for each package
- **THEN** the latest version is successfully retrieved for each package
- **AND** these versions are used for the upgrade

#### Scenario: Some packages fail to resolve

- **GIVEN** one or more packages cannot be found in the npm registry
- **WHEN** `zap npm upgrade` attempts to fetch their versions
- **THEN** a warning is logged for packages that failed to resolve
- **AND** these packages are skipped
- **AND** other packages are still upgraded successfully

#### Scenario: Network connectivity issues

- **GIVEN** the npm registry is unreachable due to network issues
- **WHEN** `zap npm upgrade` attempts to fetch package versions
- **THEN** a clear error message is displayed indicating the network problem
- **AND** the process exits with a non-zero exit code
- **AND** no files are modified

### Requirement: Upgrade all dependency types

The command MUST upgrade both `dependencies` and `devDependencies` sections in package.json.

#### Scenario: Package has both dependencies and devDependencies

- **GIVEN** package.json contains both dependencies and devDependencies sections
- **WHEN** `zap npm upgrade` is executed
- **THEN** all packages in both sections are checked for updates
- **AND** both sections are updated with latest versions

#### Scenario: Package has only dependencies

- **GIVEN** package.json contains only a dependencies section
- **WHEN** `zap npm upgrade` is executed
- **THEN** only the dependencies section is updated
- **AND** no devDependencies section is added

#### Scenario: Package has only devDependencies

- **GIVEN** package.json contains only a devDependencies section
- **WHEN** `zap npm upgrade` is executed
- **THEN** only the devDependencies section is updated
- **AND** no dependencies section is added

### Requirement: Preserve version range symbols

The command MUST preserve existing version range symbols (^, ~, >=, etc.) when updating version numbers.

#### Scenario: Dependency uses caret range

- **GIVEN** a dependency is specified as "^1.0.0"
- **WHEN** the latest version is 2.0.0
- **THEN** the updated version is "^2.0.0"
- **AND** the caret symbol is preserved

#### Scenario: Dependency uses tilde range

- **GIVEN** a dependency is specified as "~1.0.0"
- **WHEN** the latest version is 2.0.0
- **THEN** the updated version is "~2.0.0"
- **AND** the tilde symbol is preserved

#### Scenario: Dependency uses exact version

- **GIVEN** a dependency is specified as "1.0.0" (no range symbol)
- **WHEN** the latest version is 2.0.0
- **THEN** the updated version is "2.0.0"
- **AND** no range symbol is added

#### Scenario: Dependency uses complex range

- **GIVEN** a dependency is specified as ">=1.0.0"
- **WHEN** the latest version is 2.0.0
- **THEN** the updated version is ">=2.0.0"
- **AND** the >= symbol is preserved

### Requirement: Update package.json file

The command MUST write the updated dependency versions back to package.json while preserving file structure and formatting.

#### Scenario: Package.json is updated successfully

- **GIVEN** new versions have been determined for dependencies
- **WHEN** package.json is written to disk
- **THEN** the file contains the updated version numbers
- **AND** the overall JSON structure is preserved
- **AND** the file is valid JSON

#### Scenario: Write operation fails

- **GIVEN** package.json is read-only or the disk is full
- **WHEN** the command attempts to write the updated file
- **THEN** a clear error message is displayed
- **AND** the process exits with a non-zero exit code

### Requirement: Run npm install automatically

The command MUST execute `npm install` after successfully updating package.json to apply the changes.

#### Scenario: Npm install succeeds

- **GIVEN** package.json has been updated with new versions
- **WHEN** `npm install` is executed
- **THEN** the installation completes successfully
- **AND** package-lock.json is updated to reflect new versions
- **AND** node_modules contains the new package versions
- **AND** the process exits with exit code 0

#### Scenario: Npm install fails

- **GIVEN** package.json has been updated with new versions
- **WHEN** `npm install` is executed and encounters an error
- **THEN** the npm error output is displayed to the user
- **AND** the process exits with a non-zero exit code

### Requirement: Display upgrade progress and results

The command MUST provide clear, informative output showing which packages were upgraded and the results.

#### Scenario: Successful upgrade with multiple packages

- **GIVEN** multiple dependencies are being upgraded
- **WHEN** the upgrade process runs
- **THEN** output shows each package being processed
- **AND** output shows the old and new version for each upgraded package
- **AND** output confirms npm install is running
- **AND** final success message is displayed

#### Scenario: No upgrades available

- **GIVEN** all dependencies are already at their latest versions
- **WHEN** `zap npm upgrade` is executed
- **THEN** output indicates that all packages are up to date
- **AND** package.json is not modified
- **AND** npm install is not executed

#### Scenario: Partial upgrade success

- **GIVEN** some packages can be upgraded and others cannot
- **WHEN** `zap npm upgrade` is executed
- **THEN** output shows which packages were successfully upgraded
- **AND** output shows warnings for packages that were skipped
- **AND** the process continues and exits successfully for the packages that worked
