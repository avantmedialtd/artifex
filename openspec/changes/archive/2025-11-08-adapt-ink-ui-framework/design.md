# Design: Adapt Ink UI Framework

## Architecture Overview

This change introduces Ink as the presentation layer for zap's CLI, replacing direct ANSI console output with React components. The architecture maintains the existing command-based structure while upgrading UI capabilities.

### Current Architecture

```
main.ts → router.ts → commands/*.ts → utils/output.ts → console.log (ANSI)
```

Commands call simple output functions (success, error, info) that write ANSI-colored text to stdout/stderr.

### Proposed Architecture

```
main.ts → router.ts → commands/*.ts → Ink Components → ink.render() → terminal
                                   ↘ utils/output.ts (wrappers) → Ink Components
```

Commands can either:
1. Use backward-compatible wrapper functions for simple output (minimal changes)
2. Render Ink components directly for interactive/live UI (full control)

## Component Architecture

### Component Library Structure

```
components/
├── messages.tsx       # Success, Error, Info, Warn components
├── layout.tsx         # Header, Section, ListItem components
├── progress.tsx       # Spinner, ProgressBar components
├── input.tsx          # TextInput wrapper
├── select.tsx         # Select/Choice component with keyboard nav
├── confirm.tsx        # Confirmation (yes/no) component
├── table.tsx          # Data table with Flexbox layout
└── status-display.tsx # Multi-line live status display
```

Each component encapsulates:
- Visual styling (colors, spacing)
- Layout logic (Flexbox properties)
- State management (React hooks)
- Interaction handlers (keyboard input, updates)

### Utility Module Structure

```
utils/
├── output.ts          # Backward-compatible wrappers (updated)
├── ink-render.ts      # Render utilities and signal handling
└── claude.ts          # Existing utility (unchanged)
```

## Rendering Patterns

### Pattern 1: Static Output (Simple Messages)

For fire-and-forget messages, use wrapper functions:

```typescript
// Existing code - no changes needed
success('Operation completed!');
error('Something went wrong');
```

Wrappers internally render Ink components but provide synchronous API.

### Pattern 2: Interactive Components (Full Control)

For interactive/live UI, render components directly:

```typescript
import { render } from '../utils/ink-render.js';
import { MyInteractiveComponent } from '../components/my-component.js';

const { waitUntilExit } = render(<MyInteractiveComponent />);
await waitUntilExit();
```

This pattern provides full control over component lifecycle and state.

## State Management Strategy

### Component State

Use React hooks for component-local state:
- `useState` for UI state (selected option, input value)
- `useEffect` for side effects (timers, subscriptions)
- `useInput` (Ink hook) for keyboard input

### Application State

For state shared across components:
- Pass props down from parent components
- Use React Context API for deeply nested data
- Avoid external state management libraries (Redux, Zustand) initially

## Signal Handling and Cleanup

### Graceful Shutdown

The `ink-render.ts` utility handles process signals:

```typescript
process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
});

process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
});
```

This ensures Ink components unmount cleanly when user presses Ctrl+C.

### Component Cleanup

Ink components should clean up resources in `useEffect` cleanup functions:

```typescript
useEffect(() => {
    const timer = setInterval(() => { /* update */ }, 100);
    return () => clearInterval(timer);
}, []);
```

## TypeScript Integration

### JSX Configuration

Update `tsconfig.json`:

```json
{
    "compilerOptions": {
        "jsx": "react",
        "jsxImportSource": "react"
    }
}
```

### File Extensions

- Use `.tsx` extension for files with JSX
- Use `.ts` extension for non-JSX files
- Imports must use `.js` extension (ES module convention)

### Type Safety

Leverage Ink's TypeScript types:
- Import types from `@types/ink`
- Define props interfaces for custom components
- Use React.FC<Props> for component types

## Migration Strategy

### Phase 1: Backward Compatibility

Maintain existing API by wrapping Ink components:

```typescript
// utils/output.ts
export function success(message: string): void {
    const { waitUntilExit } = render(<Success message={message} />);
    waitUntilExit(); // Block until rendered
}
```

This allows existing commands to work without changes.

### Phase 2: Incremental Enhancement

Gradually migrate commands to use Ink directly:
1. Start with simple static components
2. Add interactive inputs where beneficial
3. Introduce live progress for long operations
4. Build complex dashboards for watch modes

### Phase 3: Full Adoption

Eventually, all commands use Ink components directly for consistency and full control.

## Performance Considerations

### Rendering Overhead

Ink adds minimal overhead:
- React reconciliation is fast for CLI updates
- Ink's custom renderer is optimized for terminals
- Static content renders once and exits immediately

### Bundle Size

Ink and React increase bundle size:
- Ink: ~500KB (minified)
- React: ~100KB (minified)

Mitigation: CLI tools typically don't optimize for bundle size; startup time is more important.

### Startup Time

Measure impact:
- Current: `time zap help` (baseline)
- With Ink: `time zap help` (after migration)

If startup time increases significantly (>100ms), investigate lazy loading.

## Testing Strategy

### Component Testing

Use Vitest with Ink testing utilities:
- `ink-testing-library` for rendering components in tests
- Test component output and interactions
- Mock stdin for input testing

### Integration Testing

Test commands end-to-end:
- Run actual commands in test environment
- Capture stdout/stderr for assertions
- Test exit codes and error handling

### Manual Testing

Test interactive components in real terminal:
- Different terminal emulators (iTerm, Terminal.app, etc.)
- Different terminal sizes
- Keyboard input and signal handling

## Compatibility Considerations

### Terminal Compatibility

Ink works in most modern terminals:
- ✅ macOS: Terminal.app, iTerm2
- ✅ Linux: GNOME Terminal, Konsole, xterm
- ✅ Windows: Windows Terminal, ConEmu
- ⚠️ Limited support in basic terminals without ANSI color

### CI/CD Environments

Ink degrades gracefully in non-interactive environments:
- Static components render normally
- Interactive components may need `--no-interactive` flag
- Progress indicators should disable animations in CI

## Dependencies and Versions

### Required Packages

- `ink`: ^4.0.0 (latest stable)
- `react`: ^18.0.0 (peer dependency)
- `@types/ink`: ^4.0.0 (dev)
- `@types/react`: ^18.0.0 (dev)

### Optional Packages (Future)

- `ink-testing-library`: For component tests
- `ink-spinner`: Additional spinner styles
- `ink-text-input`: Enhanced input component

## Trade-offs and Decisions

### Decision: Full Migration vs Hybrid Approach

**Chosen**: Hybrid approach with backward-compatible wrappers

**Rationale**:
- ✅ Minimizes disruption to existing commands
- ✅ Allows incremental migration
- ✅ Provides escape hatch for simple use cases
- ⚠️ Requires maintaining two rendering modes

**Alternative**: Full migration (replace all console.log calls)
- ❌ High upfront cost
- ❌ Potential breaking changes
- ✅ Cleaner architecture long-term

### Decision: Component Library vs Ad-hoc Components

**Chosen**: Build reusable component library

**Rationale**:
- ✅ Consistency across commands
- ✅ Reduces duplication
- ✅ Easier to test and maintain
- ⚠️ Upfront design effort

**Alternative**: Let each command build its own components
- ❌ Inconsistent UI
- ❌ Code duplication
- ✅ Faster initial development

### Decision: React Context vs Props

**Chosen**: Start with props, add Context only if needed

**Rationale**:
- ✅ Simpler to understand and debug
- ✅ Explicit data flow
- ⚠️ Prop drilling for deeply nested components

**Alternative**: Use Context from the start
- ❌ Adds complexity
- ✅ Cleaner for deeply nested data

## Future Enhancements

### Themes and Customization

Allow users to customize colors and styles:
- Define theme config in `.zaprc` or environment variables
- Pass theme to components via React Context
- Support light/dark modes

### Advanced Layout Components

Build more sophisticated layouts:
- Split panes for parallel operations
- Tabs for grouped content
- Scrollable regions for long output

### Animation and Transitions

Add polish with animations:
- Smooth transitions between states
- Fade in/out for messages
- Loading skeletons for data fetching

### Accessibility

Improve screen reader support:
- ARIA labels for interactive components
- Keyboard shortcuts documentation
- High-contrast mode support

## Risks and Mitigations

### Risk: Breaking Changes

**Impact**: Existing commands might break during migration

**Mitigation**:
- Maintain backward-compatible wrappers
- Test all commands after each migration phase
- Provide rollback plan (git revert)

### Risk: Performance Regression

**Impact**: Startup time or rendering might slow down

**Mitigation**:
- Measure performance before/after
- Profile if issues found
- Lazy load Ink for simple commands if needed

### Risk: Complexity Increase

**Impact**: Higher learning curve for contributors

**Mitigation**:
- Create clear documentation and examples
- Provide reference implementation
- Code review to ensure patterns are followed

### Risk: Dependency on External Library

**Impact**: Ink maintenance affects zap

**Mitigation**:
- Ink is widely used (GitHub Copilot, Prisma, etc.)
- Active maintenance and community
- Could fork if necessary (open source)

## Success Metrics

### Developer Experience

- Time to implement new command with UI: < 30 minutes
- Developer satisfaction with Ink integration
- Code review feedback on component quality

### User Experience

- User feedback on interactive features
- Perceived responsiveness during operations
- Error rate reduction from better UI

### Technical Metrics

- Test coverage for Ink components: > 80%
- Startup time increase: < 100ms
- Zero regression bugs in existing commands
