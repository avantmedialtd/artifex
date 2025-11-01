## Context

The `zap todo` command currently runs once and exits. Developers often need to see their progress update in real-time as they work through tasks. A watch mode provides continuous feedback without manual command re-execution.

## Goals / Non-Goals

**Goals:**
- Provide real-time updates when tasks.md files change
- Maintain clean, non-flickering terminal display
- Minimize CPU usage when idle (event-driven, not polling)
- Support graceful shutdown

**Non-Goals:**
- Advanced filtering or sorting beyond what `todo` provides
- Configuration file for watch behavior
- Multiple output formats (JSON, etc.) in watch mode
- Watch mode for other commands (only `todo` for now)

## Decisions

### File Watching Approach

**Decision:** Use Node.js built-in `fs.watch()` with recursive option (available in Node 20+) to monitor the `openspec/changes/` directory.

**Rationale:**
- No external dependencies needed (chokidar adds ~500KB)
- Node 20+ recursive watching is stable and cross-platform
- Project already requires modern Node.js
- Sufficient for watching a single directory tree

**Alternatives considered:**
- `chokidar`: More robust but adds dependency weight
- Polling with `fs.stat()`: Higher CPU usage, not event-driven
- `watchman`: Overkill for this use case, requires external installation

### Terminal Display Strategy

**Decision:** Use ANSI escape codes to clear screen and reposition cursor, display timestamp header.

**Rationale:**
- Simple implementation with built-in terminal capabilities
- No external TUI library needed
- Matches existing output formatting style
- Clear visual separation between updates

**Alternatives considered:**
- `blessed` or `ink` TUI library: Too complex for simple refresh display
- Scroll-based append: Creates clutter, hard to see current state
- Split-pane display: Requires terminal capability detection

### Refresh Debouncing

**Decision:** Debounce file system events with 100ms delay to batch rapid changes.

**Rationale:**
- Text editors often trigger multiple file events per save
- Reduces unnecessary screen flicker
- 100ms is imperceptible to users but catches most batched events

## Risks / Trade-offs

**Risk:** File watching may not work reliably on all platforms (network drives, Docker volumes)
- **Mitigation:** Document known limitations; users can fall back to manual `zap todo`

**Risk:** Long-running watch process could leak memory
- **Mitigation:** Keep watch implementation simple; no caching or state accumulation

**Trade-off:** Watch mode vs terminal multiplexer (tmux/screen)
- Users could run `watch -n 1 zap todo` instead
- However, built-in watch provides better UX (event-driven, instant updates, proper cleanup)

## Migration Plan

No migration needed. This is a new additive command that doesn't change existing behavior.

**Rollback:** Simply remove the watch command; `zap todo` continues working independently.

## Open Questions

- Should watch mode show a "Watching for changes..." status indicator?
  - **Answer:** Yes, include timestamp and watching status in header
- Should watch mode support filtering by specific change IDs?
  - **Answer:** Defer to future proposal if needed; keep initial implementation simple
