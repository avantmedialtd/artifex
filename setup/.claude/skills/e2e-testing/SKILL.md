---
name: e2e-testing
description: E2E and visual regression testing with Playwright. Use when writing tests, running E2E tests, debugging test failures, or working with visual baselines. Contains test commands, patterns, and debugging tips.
---

# E2E Testing Guide

Playwright-based E2E and visual regression testing.

## Quick Reference

```bash
# Run all tests
CI=1 af e2e

# Run specific test
CI=1 af e2e npm run e2e -- --grep "test name"

# Run specific file
CI=1 af e2e npm run e2e -- Feature.spec.ts

# Update visual baselines
af e2e npm run e2e -- --update-snapshots
```

## Critical Requirements

- **ALWAYS add E2E tests** for every feature change
- **ALWAYS run E2E tests** after code changes
- **NEVER run tests outside Docker**
- **Read `error-context.md`** in `./test-results/` for DOM state at failure
- **ALWAYS** confirm all tests are passing by running all tests after you believe you are finished

## Output Directories

- `playwright-report/` - HTML report with traces
- `test-results/` - Failure artifacts including `error-context.md`

For test patterns and visual testing, see [PATTERNS.md](PATTERNS.md).

---

# E2E Testing Skill

You are now in E2E testing mode. Help the user write new tests or debug failing tests.

## Running Tests

**Only use this command:**

```bash
CI=1 af e2e
```

**For faster iteration on specific tests:**

```bash
CI=1 af e2e npm run e2e -- --grep "test name pattern"
```

**For specific test file:**

```bash
CI=1 af e2e npm run e2e -- Feature.spec.ts
```

**Note:** The test runner output is already context-efficient. Do NOT pipe to `head`, `tail`, or other commands to reduce output - the reporter is optimized for AI consumption.

## Debugging Failures

When tests fail:

1. Read `./test-results/*/error-context.md` - contains YAML DOM snapshot at failure time
2. Check the error message for selector issues
3. For strict mode violations, make selectors more specific

## Writing Tests

### Basic Test Pattern

```typescript
import { expect, test } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(process.env.BASE_URL ?? '');
  });

  test('should do something', { tag: '@feature' }, async ({ page }) => {
    // Test implementation
  });
});
```

### Navigation

Use a consistent navigation helper or direct page.goto:

```typescript
// Direct navigation
await page.goto(`${process.env.BASE_URL}/path`);

// Or use a project-specific helper
import openPage from '../steps/openPage';
await openPage(page, 'app-name', '/path');
```

### Tags

Apply appropriate tags to tests for filtering:

```typescript
// Single tag
test('should work', { tag: '@api' }, async ({ page }) => {});

// Multiple tags
test('should work', { tag: ['@feature', '@visual'] }, async ({ page }) => {});
```

### Selector Patterns

**Use `level` for headings to avoid strict mode violations:**

```typescript
// Good - specific heading level
await expect(page.getByRole('heading', { name: 'Title', level: 1 })).toBeVisible();

// Bad - may match H1 and H2
await expect(page.getByRole('heading', { name: 'Title' })).toBeVisible();
```

**Scope selectors to sections:**

```typescript
const heroSection = page.locator('section').first();
await expect(heroSection.getByText('Welcome')).toBeVisible();
```

**Use `.first()` when multiple matches are acceptable:**

```typescript
await expect(page.getByText('Item').first()).toBeVisible();
```

**Handle mobile vs desktop:**

```typescript
const viewport = page.viewportSize();
const isMobile = viewport ? viewport.width < 768 : false;

if (isMobile) {
  await nav.getByRole('button', { name: 'Toggle menu' }).click();
}
```

### Visual Regression Tests

```typescript
test(
  'should match visual baseline',
  { tag: ['@feature', '@visual'] },
  async ({ page }) => {
    await page.goto(process.env.BASE_URL ?? '');

    // Wait for key element - NEVER use networkidle
    await expect(page.getByRole('heading', { name: 'Title', level: 1 })).toBeVisible();

    await expect(page).toHaveScreenshot('page-name.png', {
      fullPage: true,
    });
  },
);
```

**Update baselines (Docker only):**

```bash
af e2e npm run e2e -- --update-snapshots
af e2e npm run e2e -- --grep "page name" --update-snapshots  # specific test
```

### Masking Dynamic Content in Visual Tests

When testing pages with dynamic content (dates, counts, etc.), use the `mask` option:

**Option 1: Use data-testid attributes (recommended)**

```tsx
// In component
<Box data-testid="dynamic-content">{count} Items</Box>
```

Then mask in test:

```typescript
await expect(page).toHaveScreenshot('page.png', {
  fullPage: true,
  mask: [page.locator('[data-testid="dynamic-content"]')],
});
```

**Option 2: Use CSS selectors or text patterns**

```typescript
await expect(page).toHaveScreenshot('page.png', {
  fullPage: true,
  mask: [
    page.locator('.dynamic-class'),
    page.locator('h2'),
    page.locator('text=/\\d+ days|today|tomorrow/'),
  ],
});
```

**Best practices for masking:**

- Prefer `data-testid` for precise, reliable masking
- Text pattern matching (`text=/regex/`) can be fragile with nested elements
- Masked areas appear as pink rectangles in screenshots

### API Tests

```typescript
test('should handle API request', { tag: '@api' }, async ({ request }) => {
  const baseUrl = process.env.API_URL;

  const response = await request.post(`${baseUrl}/graphql`, {
    data: {
      query: `query { ... }`,
      variables: { id: 1 },
    },
    headers: {
      'Content-Type': 'application/json',
      Authorization: `bearer ${authToken}`,
    },
  });

  expect(response.status()).toBe(200);
});
```

### Test Data

- Each test file should use dedicated test data to avoid conflicts
- Document which test data is used at the top of the file
- Use real generated keys from seed data, never mock keys

```typescript
// Document test data at top of file
// DEDICATED TO this-test.spec.ts: booking ID 6, user "testuser"
```

### Date Handling

Use future dates with unique offsets to avoid conflicts:

```typescript
const unique = Date.now();
const uniqueYear = 2030 + Math.floor((unique % 1000000) / 10000) + 1;
const testDate = new Date(uniqueYear, 0, 15);
```

### File Upload Tests

Use minimal valid files for upload tests:

```typescript
const VALID_JPEG_IMAGE = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=',
  'base64',
);
```

### Slow Tests

Mark long-running tests:

```typescript
test('should complete flow', async ({ page }) => {
  test.slow(); // Triples timeout
  // ...
});
```

### Retries for Flaky Tests

```typescript
test.describe('Feature', () => {
  test.describe.configure({ retries: 10 });
  // ...
});
```

## Anti-patterns

**Never do:**

- Use `waitForLoadState('networkidle')` - unreliable, causes timeouts
- Run Playwright directly outside Docker
- Use if statements in assertions (use proper matchers)
- Create mock auth keys (use real seed data keys)
- Use hardcoded dates that may conflict with other tests

**Always do:**

- Wait for specific visible elements before assertions
- Use `level` parameter for heading selectors
- Scope selectors to avoid strict mode violations
- Run tests via `CI=1 af e2e`
- Read `error-context.md` for debugging failures

## Workflow

1. **Writing new tests:**
   - Identify which app(s) the test covers
   - Choose appropriate file name and location
   - Follow patterns above
   - Run with `--grep` to test iteratively

2. **Debugging failures:**
   - Run the failing test with `--grep`
   - Read `./test-results/*/error-context.md`
   - Check DOM snapshot for actual element structure
   - Fix selectors based on actual DOM

3. **Visual regression failures:**
   - If intentional change: update baseline with `af e2e npm run e2e -- --update-snapshots`
   - If unintentional: fix the CSS/layout issue
