"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// Mock vscode module
const mockReadFile = async (content) => Buffer.from(content, 'utf-8');
(0, vitest_1.describe)('parseTasksFile', () => {
    (0, vitest_1.it)('should parse valid tasks.md with sections and tasks', async () => {
        const content = `# Tasks

## Implementation Tasks

- [ ] Task 1
- [x] Task 2
- [ ] Task 3

## Testing Tasks

- [x] Test 1
- [ ] Test 2
`;
        // Note: This test requires proper mocking of vscode.workspace.fs
        // For now, this is a placeholder structure
        // In a real implementation, you would use a testing framework that supports VSCode API mocking
    });
    (0, vitest_1.it)('should handle empty files', async () => {
        // Test with empty content
    });
    (0, vitest_1.it)('should handle malformed markdown', async () => {
        // Test with invalid markdown
    });
    (0, vitest_1.it)('should count completed and total tasks correctly', async () => {
        // Test task counting
    });
    (0, vitest_1.it)('should handle nested tasks with indentation', async () => {
        const content = `## Tasks

- [ ] Parent task
    - [x] Child task 1
    - [ ] Child task 2
`;
        // Test indentation handling
    });
});
//# sourceMappingURL=taskParser.test.js.map