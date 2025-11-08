# Tasks: Adapt Ink UI Framework

## Phase 1: Foundation Setup

- [ ] **Install Ink dependencies**
    - Add `ink`, `react`, `@types/ink`, `@types/react` to package.json
    - Run `npm install` to install dependencies
    - Verify installation with `npm ls ink`
    - **Validation**: Dependencies appear in package.json and node_modules

- [ ] **Configure TypeScript for JSX**
    - Update `tsconfig.json` with `"jsx": "react"` or `"jsx": "react-jsx"`
    - Ensure `.tsx` files are recognized by the compiler
    - Test compilation with a simple Ink component file
    - **Validation**: TypeScript compiles `.tsx` files without errors

- [ ] **Create Ink render utilities**
    - Create `utils/ink-render.ts` with `render()` and `cleanup()` helpers
    - Implement signal handling (SIGINT, SIGTERM) for graceful shutdown
    - Add TypeScript types for render function parameters
    - **Validation**: Utility renders a simple `<Text>` component and unmounts on Ctrl+C

## Phase 2: Output Components Migration

- [ ] **Create basic message components**
    - Create `components/messages.tsx` with Success, Error, Info, Warn components
    - Implement color styling using Ink's `<Text>` color props
    - Match visual appearance of existing ANSI output functions
    - **Validation**: Components render with correct colors and formatting

- [ ] **Create layout components**
    - Create `components/layout.tsx` with Header, Section, ListItem components
    - Implement spacing and indentation using `<Box>` and `<Text>`
    - Match visual appearance of existing layout functions
    - **Validation**: Components produce identical output to current implementation

- [ ] **Create backward-compatible wrappers**
    - Update `utils/output.ts` to wrap Ink components in synchronous functions
    - Maintain existing function signatures (success, error, info, warn, header, section, listItem)
    - Ensure wrappers render components and block until complete
    - **Validation**: All existing command handlers work without modification

## Phase 3: Interactive Components Library

- [ ] **Create progress indicator components**
    - Create `components/progress.tsx` with Spinner and ProgressBar components
    - Implement Spinner with animation and custom labels
    - Implement ProgressBar with percentage and visual bar display
    - **Validation**: Spinner animates continuously; ProgressBar updates on value change

- [ ] **Create input components**
    - Create `components/input.tsx` with TextInput wrapper
    - Integrate Ink's built-in `useInput` hook for keyboard handling
    - Add placeholder text and controlled value support
    - **Validation**: TextInput accepts user input and invokes callbacks

- [ ] **Create selection components**
    - Create `components/select.tsx` with Select/Choice component
    - Implement keyboard navigation (up/down arrows, Enter to confirm)
    - Support both single-select and multi-select modes
    - Add visual highlighting for selected option
    - **Validation**: Component navigates options and returns selected value

- [ ] **Create confirmation component**
    - Create `components/confirm.tsx` for yes/no prompts
    - Accept y/n or yes/no input
    - Support default value configuration
    - **Validation**: Component returns boolean based on user confirmation

## Phase 4: Advanced Display Components

- [ ] **Create table component**
    - Create `components/table.tsx` with flexible table layout
    - Use `<Box>` with Flexbox for column layout
    - Support column headers and automatic width calculation
    - Enable live data updates and re-rendering
    - **Validation**: Table displays multiple columns with proper alignment and updates

- [ ] **Create multi-status display component**
    - Create `components/status-display.tsx` for tracking multiple operations
    - Use `<Box>` with `flexDirection="column"` for stacked status lines
    - Support independent updates per status line
    - Handle terminal resize gracefully
    - **Validation**: Multiple status lines update independently without flickering

## Phase 5: Reference Implementation

- [ ] **Migrate one command to full Ink usage**
    - Choose a suitable command (e.g., `watch`, `spec apply`, or create new demo command)
    - Refactor to use Ink components for all UI rendering
    - Demonstrate interactive inputs, live progress, and component lifecycle
    - Add detailed code comments explaining Ink patterns
    - **Validation**: Command works end-to-end with interactive Ink UI

- [ ] **Create Ink integration documentation**
    - Document Ink component usage patterns in CLAUDE.md or new docs file
    - Provide examples of static vs interactive rendering
    - Document common patterns (render/cleanup, input handling, live updates)
    - **Validation**: New developers can build Ink-based commands using documentation

## Phase 6: Testing and Validation

- [ ] **Test backward compatibility**
    - Run all existing commands to ensure output still works
    - Verify exit codes remain correct (0 = success, 1 = error)
    - Check that no commands were broken by migration
    - **Validation**: All commands in `router.ts` execute successfully

- [ ] **Test interactive components in terminal**
    - Test Spinner and ProgressBar in real terminal
    - Test TextInput and Select with keyboard input
    - Test signal handling (Ctrl+C gracefully exits)
    - Test terminal resize behavior
    - **Validation**: All interactive components work as expected in real usage

- [ ] **Run linting and formatting checks**
    - Run `npm run lint` and fix any issues
    - Run `npm run format` to ensure code style consistency
    - Run `npm run spell:check` to catch any typos
    - **Validation**: All quality checks pass

- [ ] **Update project documentation**
    - Update CLAUDE.md with Ink integration details
    - Update architecture section with component-based UI patterns
    - Add section on Ink utilities and component library
    - **Validation**: Documentation accurately reflects new architecture

## Dependencies

- Tasks in Phase 2 depend on Phase 1 completion
- Tasks in Phase 3-4 can be done in parallel after Phase 2
- Phase 5 requires completion of Phases 2-4
- Phase 6 requires completion of all previous phases

## Notes

- Start with backward-compatible wrappers to minimize disruption
- Migrate commands to full Ink usage incrementally after initial setup
- Focus on reference implementation quality to guide future command migrations
- Test each component in isolation before integrating into commands
