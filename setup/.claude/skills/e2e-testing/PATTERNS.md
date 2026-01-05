# E2E Test Patterns

## Test Writing Guidelines

### Navigation Pattern

```typescript
// In beforeEach
await page.goto(process.env.BASE_URL ?? '');

// Navigate to specific pages in tests
await page.goto(`${process.env.BASE_URL ?? ''}/page-path`);
```

### Strict Mode Compliance

Always use specific selectors to avoid strict mode violations:

```typescript
// Use level for headings
getByRole('heading', { name: 'Title', level: 1 })

// Use .first() for multi-element selectors
page.locator('.item').first()

// Use full text matches
getByText('Complete checkout') // not getByText('checkout')
```

### Test Organization

- Group tests by page/feature
- Each test file should use dedicated test data to avoid conflicts
- Document which test data is used at the top of each file

## Visual Regression Testing

### When to Add Visual Tests

- Creating new public-facing pages
- Implementing complex layouts
- Making significant styling changes

### When to Update Baselines

Update for **intentional** design changes:

- CSS modifications
- Layout adjustments
- Responsive design changes

### Update Command

```bash
# Update all
af e2e npm run e2e -- --update-snapshots

# Update specific test
af e2e npm run e2e -- --grep "page name" --update-snapshots
```

### Visual Test Pattern

```typescript
test(
  'should match visual baseline',
  { tag: ['@feature', '@visual'] },
  async ({ page }) => {
    await page.goto(process.env.BASE_URL ?? '');

    // Wait for key element (NOT networkidle)
    await expect(
      page.getByRole('heading', { name: 'Title', level: 1 })
    ).toBeVisible();

    // Capture screenshot
    await expect(page).toHaveScreenshot('page.png', {
      fullPage: true,
    });
  },
);
```

**Important:** Never use `waitForLoadState('networkidle')` - it's unreliable and causes timeouts.

## Debugging Tips

1. Check `./test-results/TestName-.../error-context.md` for DOM state
2. Use `--grep` for faster iteration on failing tests
3. YAML DOM snapshots show elements at failure time
4. More useful than screenshots for selector issues

## Test Data Rules

- Tests use real seed data with generated auth keys
- Never use mock keys - always use real generated keys
- Don't use if statements in tests
