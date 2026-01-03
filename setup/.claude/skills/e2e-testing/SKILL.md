---
name: e2e-testing
description: E2E and visual regression testing with Playwright. Use when writing tests, running E2E tests, debugging test failures, or working with visual baselines. Contains test commands, patterns, and debugging tips.
---

# E2E Testing Guide

Playwright-based E2E and visual regression testing for area51-web.

## Quick Reference

```bash
# Run all tests
CI=1 FAIL_FAST=1 ./scripts/e2e_tests.ts

# Run specific test
CI=1 FAIL_FAST=1 ./scripts/e2e_tests.ts -- --grep "booking flow"

# Run specific file
CI=1 FAIL_FAST=1 ./scripts/e2e_tests.ts -- Homepage.spec.ts

# Update visual baselines
./scripts/update-visual-baselines.ts
```

## Critical Requirements

- **ALWAYS add E2E tests** for every feature change
- **ALWAYS run E2E tests** after code changes
- **NEVER run tests outside Docker**
- **Read `error-context.md`** in `./test-results/` for DOM state at failure
- **ALWAYS** confirm all tests are passing by running all tests after you believe you are finished.

## Output Directories

- `playwright-report/` - HTML report with traces
- `test-results/` - Failure artifacts including `error-context.md`

For test patterns and visual testing, see [PATTERNS.md](PATTERNS.md).

# E2E Testing Skill

You are now in E2E testing mode. Help the user write new tests or debug failing tests.

## Running Tests

**Only use this command:**

```bash
CI=1 FAIL_FAST=1 ./scripts/e2e_tests.ts
```

**For faster iteration on specific tests:**

```bash
CI=1 FAIL_FAST=1 ./scripts/e2e_tests.ts -- --grep "test name pattern"
```

**For specific test file:**

```bash
CI=1 FAIL_FAST=1 ./scripts/e2e_tests.ts -- Homepage.spec.ts
```

## Debugging Failures

When tests fail:

1. Read `./test-results/*/error-context.md` - contains YAML DOM snapshot at failure time
2. Check the error message for selector issues
3. For strict mode violations, make selectors more specific

## Writing Tests

### File Structure

Tests go in `e2e/tests/`. Use these naming conventions:

- `area51-web-*.spec.ts` - area51-web specific tests
- `area51-web-visual-*.spec.ts` - visual regression tests
- Feature-based names for cross-app tests (e.g., `BookingJourney.spec.ts`)

### Basic Test Pattern

```typescript
import { expect, test } from '@playwright/test';
import openPage from '../steps/openPage';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, 'area51-web', '/');
  });

  test('should do something', { tag: '@area51-web' }, async ({ page }) => {
    // Test implementation
  });
});
```

### Navigation

Always use `openPage` helper:

```typescript
import openPage from '../steps/openPage';

// area51-web
await openPage(page, 'area51-web', '/book');

// hosting-web
await openPage(page, 'hosting-web', '/1/calendar');
```

### Hosting-Web Login Patterns

For tests requiring authentication in hosting-web:

**Multi-property user (istvan - globalAdmin):**

```typescript
import selectProperty from '../steps/selectProperty';

await openPage(page, 'hosting-web', '/');
await page.getByLabel('Username').fill(process.env.TEST_ADMIN_USER!);
await page.getByLabel('Password').fill(process.env.TEST_ADMIN_PASSWORD!);
await page.getByRole('button', { name: 'Login' }).click();

// Must select property when user has access to multiple
await selectProperty(page, 'Area 51 Budapest ID: 1');
await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible({ timeout: 20000 });
```

**Single-property user (demo - Heavenly Haven only):**

When a user has access to only one property, the property selection dialog auto-selects and redirects. Don't call `selectProperty`:

```typescript
await openPage(page, 'hosting-web', '/');
await page.getByLabel('Username').fill('demo');
await page.getByLabel('Password').fill(process.env.TEST_ADMIN_PASSWORD!);
await page.getByRole('button', { name: 'Login' }).click();

// No selectProperty needed - auto-redirects to Heavenly Haven
await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible({ timeout: 20000 });
```

**Seed data users:**

- `istvan` (globalAdmin): Access to all properties
- `demo` (propertyAdmin): Access to Heavenly Haven (ID: 2) only

### Tags

Apply appropriate tags to tests:

- `@area51-web` - area51-web tests
- `@hosting-web` - hosting-web tests
- `@hosting-server` - API tests
- `@visual` - visual regression tests

Multiple tags: `{ tag: ['@area51-web', '@visual'] }`

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
await expect(heroSection.getByText('Premium Industrial Loft')).toBeVisible();
```

**Use `.first()` when multiple matches are acceptable:**

```typescript
await expect(page.getByText('€800').first()).toBeVisible();
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
  'should match homepage visual baseline',
  { tag: ['@area51-web', '@visual'] },
  async ({ page }) => {
    await openPage(page, 'area51-web', '/');

    // Wait for key element - NEVER use networkidle
    await expect(page.getByRole('heading', { name: 'Area 51 Budapest', level: 1 })).toBeVisible();

    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
    });
  },
);
```

**Update baselines (Docker only):**

```bash
./scripts/update-visual-baselines.ts
./scripts/update-visual-baselines.ts homepage  # specific test
```

### Masking Dynamic Content in Visual Tests

When testing pages with dynamic content (dates, counts, revenue), use the `mask` option to hide elements that change between test runs:

**Option 1: Use data-testid attributes (recommended for reliable masking)**

Add `data-testid` to dynamic elements in production code:

```tsx
// In component
<Box data-testid="notification-button">{totalCount} Actions</Box>
```

Then mask in test:

```typescript
await expect(page).toHaveScreenshot('dashboard.png', {
  fullPage: true,
  mask: [page.locator('[data-testid="notification-button"]')],
});
```

**Option 2: Use CSS selectors or text patterns**

```typescript
await expect(page).toHaveScreenshot('dashboard.png', {
  fullPage: true,
  mask: [
    // Mask by CSS class
    page.locator('.MuiCard-root'),

    // Mask all headings (month/year headers with revenue)
    page.locator('h2'),
    page.locator('h3'),

    // Mask by text pattern (less reliable)
    page.locator('text=/\\d+ days|today|tomorrow/'),
  ],
});
```

**Best practices for masking:**

- Prefer `data-testid` for precise, reliable masking
- Text pattern matching (`text=/regex/`) can be fragile with nested elements
- If too much content is dynamic, the page may not be suitable for visual regression testing
- Masked areas appear as pink rectangles in screenshots

### API Tests

```typescript
test('should handle API request', { tag: '@hosting-server' }, async ({ request }) => {
  const baseApiUrl = process.env.HOSTING_SERVER_URL;

  const response = await request.post(`${baseApiUrl}/graphql`, {
    data: {
      query: `query { ... }`,
      variables: { id: 1 },
    },
    headers: {
      'Content-Type': 'application/json',
      Authorization: `bearer ${testKey}`,
    },
  });

  expect(response.status()).toBe(200);
});
```

### Test Data

Each test file should use dedicated booking IDs to avoid conflicts:

- Document which booking IDs are used at the top of the file
- Use seed data keys (generated SHA1 hashes), never mock keys

```typescript
// Real keys generated from seed data - DEDICATED TO this-test.spec.ts
const testKeys = {
  booking6: 'guest;6;d01326200b96edc6a7118034966619859aa1ca28',
  booking9: 'guest;9;04488338939dccfe1ae3d6d82c831224baab955f',
};
```

### Date Handling for Bookings

Use future dates with unique offsets to avoid conflicts:

```typescript
const unique = Date.now();
const uniqueYear = 2030 + Math.floor((unique % 1000000) / 10000) + 1;
const checkinDate = new Date(uniqueYear, 0, 15);
```

### File Upload Tests

Use minimal valid JPEG for upload tests:

```typescript
const VALID_JPEG_IMAGE = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=',
  'base64',
);
```

### Slow Tests

Mark long-running tests:

```typescript
test('should complete booking flow', async ({ page }) => {
  test.slow(); // Triples timeout
  // ...
});
```

### Retries for Flaky Tests

```typescript
test.describe('Booking Journey', () => {
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
- Run tests via `CI=1 FAIL_FAST=1 ./scripts/e2e_tests.ts`
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
   - If intentional change: update baseline with `./scripts/update-visual-baselines.ts`
   - If unintentional: fix the CSS/layout issue
