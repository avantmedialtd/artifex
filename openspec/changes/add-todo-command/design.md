# Design: Add TODO Command

## Technical Approach

### Architecture

The `zap todo` command follows the existing command-based architecture pattern:

1. **Router integration** (`router.ts`): Routes `todo` command to handler
2. **Command handler** (`commands/todo.ts`): Main command logic
3. **Output utilities** (`utils/output.ts`): Reuse existing color/formatting functions
4. **File system access**: Direct reading of `tasks.md` files (Node.js `fs` module)

### Data Flow

```
User runs `zap todo`
    ↓
Router routes to handleTodo()
    ↓
Scan openspec/changes/ directory
    ↓
For each active change:
    - Check if tasks.md exists
    - Parse tasks.md file
    - Count completed/total tasks
    ↓
Format and display output
    ↓
Return exit code 0
```

### File Parsing Strategy

**Markdown Checkbox Detection:**
- Use regex pattern to match: `- [ ]` (unchecked) and `- [x]` or `- [X]` (checked)
- Pattern: `/^(\s*)- \[([ xX])\] (.+)$/` per line
- Capture groups: indentation, checkbox state, task description

**Section Header Detection:**
- Match lines starting with `##` (markdown h2 headers)
- Pattern: `/^## (.+)$/`
- Used to group tasks visually

**Data Structure:**
```typescript
interface Task {
    text: string;          // Task description
    completed: boolean;    // Checkbox state
    indent: number;        // Indentation level (for nested tasks)
}

interface Section {
    title: string;         // Section header text (e.g., "Implementation Tasks")
    tasks: Task[];         // Tasks under this section
}

interface ChangeTaskData {
    changeId: string;      // Change directory name
    sections: Section[];   // All sections with tasks
    totalTasks: number;    // Total checkbox items
    completedTasks: number; // Checked checkbox items
}
```

### Visual Formatting

**Colors (using existing utils/output.ts):**
- Change headers: Blue (`colors.blue`)
- Section headers: Cyan (`colors.cyan`)
- Task counts: Gray (`colors.gray`)
- Completed checkboxes: Green (`colors.green`)
- Unchecked checkboxes: Default/gray

**Box Drawing Characters:**
```
┌─ Change Name (3/10 tasks completed)
│
│  Section Name
│  ☐ Unchecked task
│  ☑ Checked task
│
└─────────────────────────────────
```

**Unicode Symbols:**
- Unchecked: `☐` (U+2610)
- Checked: `☑` (U+2611)
- Top border: `┌─`
- Vertical: `│`
- Bottom border: `└─` followed by horizontal line

### Error Handling Strategy

**Graceful Degradation:**
1. If `openspec/changes/` doesn't exist → "No active changes found."
2. If directory is empty → "No active changes found."
3. If change has no tasks.md → Display change with "No tasks.md found"
4. If tasks.md is empty → Display change with "No tasks found"
5. If tasks.md is malformed → Extract what's parseable, continue

**No Failures:**
- Command should never exit with code 1 during normal operation
- Only exit code 1 if invalid arguments provided
- Filesystem errors are caught and reported, but don't crash

### Performance Considerations

**Optimization Strategy:**
1. Read directory listing once (single `fs.readdir` call)
2. Read each tasks.md file synchronously (simple sequential I/O)
3. No external process spawning (unlike `changes` command)
4. Minimal string processing (regex-based parsing is fast)

**Expected Performance:**
- 10 changes × 20 tasks each = 200 tasks
- File reading: ~10-20ms
- Parsing: ~5-10ms
- Display: ~5-10ms
- **Total: <50ms** (well under 100ms target)

### Integration Points

**Router.ts Changes:**
```typescript
// Add import
import { handleTodo } from './commands/todo.ts';

// Add routing (after help command)
if (command === 'todo') {
    const hasArgs = args.length > 1;
    return await handleTodo(hasArgs);
}
```

**Help.ts Changes:**
- Add to command list
- Add command-specific help section
- Follow existing help formatting pattern

### Testing Strategy

**Unit Tests:**
1. Test task parsing with various markdown formats
2. Test checkbox state detection
3. Test section header extraction
4. Test completion counting
5. Test argument validation

**Integration Tests:**
1. Test with mock change directories
2. Test with missing/empty files
3. Test visual output formatting
4. Test command routing

**Manual Testing:**
1. Create real test changes
2. Verify visual output in terminal
3. Test Unicode symbol rendering
4. Test color display

### Dependencies

**No New Dependencies:**
- Node.js built-in `fs` module for file reading
- Node.js built-in `path` module for path manipulation
- Existing `utils/output.ts` for colors
- Existing command handler pattern

### Alternatives Considered and Rejected

**1. Use OpenSpec CLI (`openspec show <change> --json`)**
- ❌ Requires spawning process for each change
- ❌ Slower performance
- ❌ More complex error handling
- ✅ Direct file reading is simpler and faster

**2. Use markdown parser library**
- ❌ Adds external dependency
- ❌ Overkill for simple checkbox parsing
- ✅ Regex-based parsing is sufficient

**3. Interactive task selection (like inquirer)**
- ❌ Out of scope for v1
- ❌ Adds complexity
- ✅ Read-only display is simpler, can add interactivity later

### Future Enhancements (Out of Scope)

- Task filtering (e.g., `zap todo --change <id>`)
- Task searching (e.g., `zap todo --search <keyword>`)
- Interactive task completion (e.g., using prompts)
- Export tasks to other formats (JSON, CSV)
- Include archived changes option
