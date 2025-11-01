# Add Watch Command for Real-time TODO Monitoring

## Why

Developers working on OpenSpec changes need to see their TODO progress in real-time without manually re-running `zap todo`. A watch mode provides continuous feedback during development sessions, improving workflow efficiency.

## What Changes

- Add `zap watch` command that continuously displays the output of `zap todo`
- Monitor `openspec/changes/` directory for file changes (especially `tasks.md` files)
- Clear and refresh the display when changes are detected
- Provide a clean, non-flickering terminal UI with status indicators
- Support graceful exit with Ctrl+C

## Impact

- Affected specs: `todo-command` (modified to support watch mode)
- Affected code: 
  - `commands/todo.ts` (refactored to support both one-time and watch modes)
  - `router.ts` (add routing for watch command)
  - `commands/help.ts` (add help text for watch command)
- New dependencies: file watching library (e.g., `chokidar` or Node.js `fs.watch`)
