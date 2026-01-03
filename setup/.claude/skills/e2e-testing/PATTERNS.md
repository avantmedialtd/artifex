# E2E Test Patterns

## Test Writing Guidelines

### Navigation Pattern

```typescript
// In beforeEach
await page.goto(process.env.AREA51_WEB_URL ?? '');

// Navigate to specific pages in tests
await page.goto(`${process.env.AREA51_WEB_URL ?? ''}/page-path`);
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
- Follow patterns in `area51-web-*.spec.ts` files
- Each test file uses dedicated booking IDs:
  - `CheckinApi.spec.ts`: booking9 (Sarah Thompson)
  - `area51-web-checkin.spec.ts`: booking6 (Emily Johnson)
  - `area51-web-contact.spec.ts`: No booking needed

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
./scripts/update-visual-baselines.ts

# Update specific test
./scripts/update-visual-baselines.ts homepage
```

### Visual Test Pattern

```typescript
test(
  'should match homepage visual baseline',
  { tag: ['@area51-web', '@visual'] },
  async ({ page }) => {
    await openPage(page, 'area51-web', '/');

    // Wait for key element (NOT networkidle)
    await expect(
      page.getByRole('heading', { name: 'Area 51 Budapest', level: 1 })
    ).toBeVisible();

    // Capture screenshot
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
    });
  },
);
```

**Important:** Never use `waitForLoadState('networkidle')` - it's unreliable and causes timeouts.

### Current Visual Test Coverage

- Homepage: Hero, features, CTA sections
- Booking Page: Form with date pickers, payment
- Contact Page: Contact info and forms
- Legal Pages: Cancellation and refund policies

All tests run across 10 viewport configurations.

## Debugging Tips

1. Check `./test-results/TestName-.../error-context.md` for DOM state
2. Use `--grep` for faster iteration on failing tests
3. YAML DOM snapshots show elements at failure time
4. More useful than screenshots for selector issues

## Test Data Rules

- Tests use real seed data with generated auth keys
- Never use mock keys - always use real generated keys
- Don't use if statements in tests
