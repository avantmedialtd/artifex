# Spec: Ink Core Integration

## ADDED Requirements

### Requirement: Install Ink dependencies

The project MUST include Ink and its peer dependencies to enable React-based CLI rendering.

#### Scenario: Package dependencies configured

**Given** the project uses npm for package management
**When** installing Ink dependencies
**Then** `package.json` MUST include `ink` (latest stable version)
**And** `package.json` MUST include `react` as a peer dependency
**And** `package.json` MUST include `@types/ink` as a dev dependency
**And** `@types/react` MUST be included as a dev dependency for TypeScript support

### Requirement: Ink render integration

The CLI MUST provide a standardized way to render Ink components in command handlers.

#### Scenario: Render Ink component in command

**Given** a command handler needs to display UI
**When** rendering an Ink component
**Then** the system MUST use `ink.render()` to mount the component
**And** the render function MUST return cleanup capability to unmount on exit
**And** the render MUST handle process termination signals (SIGINT, SIGTERM) gracefully

#### Scenario: Component unmounting on command completion

**Given** an Ink component is currently rendering
**When** the command handler completes or errors
**Then** the component MUST be unmounted automatically
**And** any cleanup handlers MUST be invoked
**And** the process MUST exit with appropriate exit code (0 for success, 1 for error)

### Requirement: TypeScript configuration for JSX

The TypeScript compiler MUST support JSX syntax for Ink components.

#### Scenario: JSX compilation configured

**Given** the project uses TypeScript
**When** compiling files with JSX syntax
**Then** `tsconfig.json` MUST have `"jsx": "react"` or `"jsx": "react-jsx"` configured
**And** JSX files MUST use `.tsx` extension
**And** TypeScript MUST recognize Ink component types from `@types/ink`
