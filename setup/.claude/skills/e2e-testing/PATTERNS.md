# E2E Test Patterns

Code patterns for writing Playwright tests. For commands, debugging, and workflow, see [SKILL.md](SKILL.md).

## Basic Test Structure

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

### Tags

```typescript
test('single tag', { tag: '@api' }, async ({ page }) => {});
test('multiple tags', { tag: ['@feature', '@visual'] }, async ({ page }) => {});
```

## Navigation

```typescript
// Direct navigation
await page.goto(`${process.env.BASE_URL}/path`);

// Project-specific helper (use when navigating to an app with auth/setup)
import openPage from '../steps/openPage';
await openPage(page, 'app-name', '/path');
```

## Selectors

**Use `level` for headings to avoid strict mode violations:**

```typescript
// Good — targets exactly one heading
page.getByRole('heading', { name: 'Title', level: 1 });

// Bad — may match H1 and H2 with same text
page.getByRole('heading', { name: 'Title' });
```

**Scope selectors to sections:**

```typescript
const hero = page.locator('section').first();
await expect(hero.getByText('Welcome')).toBeVisible();
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

## Visual Regression Tests

```typescript
test(
  'should match visual baseline',
  { tag: ['@feature', '@visual'] },
  async ({ page }) => {
    await page.goto(process.env.BASE_URL ?? '');

    // Wait for a specific element — NEVER use networkidle
    await expect(page.getByRole('heading', { name: 'Title', level: 1 })).toBeVisible();

    await expect(page).toHaveScreenshot('page-name.png', {
      fullPage: true,
    });
  },
);
```

### When to Add Visual Tests

- New public-facing pages
- Complex layouts
- Significant styling changes

### Masking Dynamic Content

Mask elements that change between runs (dates, counts, etc.):

```typescript
await expect(page).toHaveScreenshot('page.png', {
  fullPage: true,
  mask: [page.locator('[data-testid="dynamic-content"]')],
});
```

Prefer `data-testid` attributes for precise masking. Text pattern matching (`text=/regex/`) can be fragile with nested elements.

## API Tests

```typescript
test('should handle API request', { tag: '@api' }, async ({ request }) => {
  const response = await request.post(`${process.env.API_URL}/graphql`, {
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

## Test Data

Each test file should use dedicated test data to avoid conflicts. Document it at the top:

```typescript
// DEDICATED TO this-test.spec.ts: booking ID 6, user "testuser"
```

Use real generated keys from seed data — never mock keys.

### Date Handling

Use future dates with unique offsets per test file to avoid conflicts between parallel tests.

### File Uploads

Use a minimal valid file buffer (e.g., a 1x1 JPEG) rather than loading real files.

## Slow and Flaky Tests

```typescript
test('long-running flow', async ({ page }) => {
  test.slow(); // Triples the timeout
});
```

For genuinely flaky tests (e.g., animations, timing-sensitive UI), retries can be used as a last resort:

```typescript
test.describe('Flaky feature', () => {
  test.describe.configure({ retries: 3 });
});
```

High retry counts mask real problems — prefer fixing the root cause.
