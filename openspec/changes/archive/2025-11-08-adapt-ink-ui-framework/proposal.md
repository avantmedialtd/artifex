# Proposal: Adapt Ink UI Framework

## Overview

Replace the current ANSI-based output utilities with Ink (https://github.com/vadimdemedes/ink), a React renderer for building interactive command-line interfaces. This migration will enable rich interactive features including live progress indicators, interactive prompts/forms, real-time status dashboards, and pretty data tables/lists using React components and Flexbox layout.

## Problem Statement

The current `utils/output.ts` module provides basic ANSI color-coded output (success, error, info, warn, header, section, listItem) but lacks capabilities for:

- **Interactive UI**: No support for user input forms, selections, or navigation within the CLI
- **Live updates**: Cannot display real-time progress indicators, spinners, or live-updating dashboards
- **Complex layouts**: Limited to simple colored text output; no Flexbox-based layout system
- **State management**: No way to build stateful, reactive UI components that update based on data changes

As zap grows in complexity, commands like `spec propose`, `spec apply`, `todo`, and `watch` would benefit from interactive interfaces that provide better user experience and visual feedback during long-running operations.

## Proposed Solution

Integrate Ink as the primary UI framework for zap's CLI interface:

1. **Add Ink dependency**: Install `ink` and `@types/ink` packages
2. **Migrate output utilities**: Convert `utils/output.ts` to Ink-based React components
3. **Create UI component library**: Build reusable Ink components for common patterns (progress bars, spinners, tables, prompts)
4. **Update existing commands**: Refactor commands to use Ink components instead of raw console.log calls
5. **Enable interactive features**: Add new capabilities like live progress tracking, interactive prompts, and real-time dashboards

This approach maintains the existing command handler architecture while upgrading the presentation layer to support modern interactive CLI experiences.

## Benefits

- **Enhanced UX**: Interactive prompts and live updates provide better feedback during operations
- **React ecosystem**: Leverage React's component model, hooks, and state management in the CLI
- **Flexbox layouts**: Use CSS-like layout properties to create sophisticated UI arrangements
- **Battle-tested**: Ink is used by GitHub Copilot CLI, Cloudflare Wrangler, Prisma, and Shopify CLI
- **Maintainability**: Component-based architecture makes UI code more modular and testable

## Risks & Mitigations

**Risk**: Increased bundle size and startup time
- *Mitigation*: Measure performance impact; Ink is designed for CLI performance

**Risk**: Breaking changes to existing command handlers
- *Mitigation*: Provide backward-compatible wrapper functions that match current output.ts API

**Risk**: Learning curve for contributors unfamiliar with React
- *Mitigation*: Create clear documentation and examples; start with simple components

## Alternatives Considered

1. **Keep current ANSI-based approach**: Simple but lacks interactive capabilities
2. **Add ink for interactive features only**: Would create inconsistent UI between simple and interactive commands
3. **Use other CLI frameworks (blessed, blessed-contrib)**: Less modern, not React-based

## Dependencies

- **Ink library**: https://github.com/vadimdemedes/ink (React renderer for CLIs)
- **React**: Peer dependency of Ink
- **Yoga**: Layout engine (bundled with Ink)

## Related Changes

This change lays the foundation for future interactive features:
- Interactive spec browser/selector
- Live watch mode with real-time file updates
- Rich todo list UI with checkboxes and navigation
- Progress tracking for npm upgrades and deployments
