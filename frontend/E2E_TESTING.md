# End-to-End Testing with Playwright

## Overview

This project uses [Playwright](https://playwright.dev/) for end-to-end testing. The tests cover all major features including authentication, books management, family management, and profile pages.

## Test Files

- **`auth.spec.ts`** - Authentication flow (login, register, logout, protected routes, validation)
  - Login with empty/invalid/wrong credentials
  - Registration with new family
  - Duplicate user prevention
  - Shared email support (multiple users, same family)
  - Password strength validation
  - Email format validation
  - Logout and session clearing
- **`books.spec.ts`** - Books management (CRUD operations, search, filters, sorting)
- **`family.spec.ts`** - Family management (dashboard, members list, admin features)
- **`profile.spec.ts`** - Profile management and home dashboard
- **`responsive.spec.ts`** - Responsive design, RTL support, and accessibility
- **`errors.spec.ts`** - Error handling and edge cases (NEW)
  - Network errors (timeout, 500, 404)
  - Invalid data validation
  - Concurrent operations
  - Browser compatibility (back button, refresh, tabs)
  - XSS protection
  - Permission checks

## Setup

### 1. Install Dependencies

Already installed if you ran `npm install` in the frontend folder.

```bash
cd frontend
npm install
```

### 2. Install Playwright Browsers

```bash
npx playwright install
```

### 3. Configure Test User

Create a `.env.test` file in the `frontend` folder:

```bash
cp .env.test.example .env.test
```

Edit `.env.test` and add real test credentials:

```env
TEST_USER_EMAIL=your-test-user@example.com
TEST_USER_PASSWORD=your-test-password
```

**Important:** Create a dedicated test user in your application for running tests. Don't use your personal account.

## Running Tests

### Run All Tests (Headless)

```bash
npm run test:e2e
```

### Run Tests with UI

Interactive mode - see tests running in real-time:

```bash
npm run test:e2e:ui
```

### Run Tests in Headed Mode

See browser windows while tests run:

```bash
npm run test:e2e:headed
```

### Debug Tests

Step through tests with debugging tools:

```bash
npm run test:e2e:debug
```

### View Test Report

After running tests, view HTML report:

```bash
npm run test:e2e:report
```

### Run Specific Test File

```bash
npx playwright test auth.spec.ts
```

### Run Specific Test

```bash
npx playwright test -g "should display login page"
```

### Run Tests on Specific Browser

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Structure

### Authentication Tests
- Login page display
- Empty credentials validation  
- Invalid email format
- Non-existent user error
- Wrong password error
- Successful login
- Registration form display with all fields
- Required field validation
- Email format validation
- Password strength validation  
- **NEW: Create user with new family**
- **NEW: Prevent duplicate user registration**
- **NEW: Allow shared email for family members**
- **NEW: Phone number validation**
- Registration flow
- Protected route redirects
- Logout functionality
- **NEW: Session clearing after logout**
- Navigation between routes

### Books Management Tests
- Display book catalog
- Search books by title
- Filter by status and genre
- Sort books
- Add new book with validation
- View book details
- Edit book (owner only)
- Delete book with confirmation
- Series and series number fields

### Family Management Tests
- Display family dashboard
- Show family statistics
- Navigate to family members
- List family members
- Admin-only features (edit, delete, add members)
- Member information display
- Admin badge visibility

### Profile Tests
- Display user profile
- Show family information
- Edit profile
- Update user information
- Logout
- Email read-only constraint

### Home Dashboard Tests
- Welcome message
- Search bar
- Catalog statistics
- Management cards
- Navigation to features
- Search from home

### Responsive & Accessibility Tests
- Mobile layout (375px width)
- Tablet layout (768px width)
- RTL (Right-to-Left) support
- Touch-friendly buttons
- Keyboard navigation
- Screen reader support
- Image alt text
- Form labels
- Page titles

### Error Handling & Edge Cases Tests (NEW)
**Network Errors:**
- API timeout handling
- 500 Internal Server Error
- 404 Not Found
- Request retry logic

**Invalid Data:**
- Missing required fields validation
- Invalid year (future/past)
- Negative numbers (pages, series)
- Extremely long text inputs
- Special characters handling
- Series number without series name

**Concurrent Operations:**
- Simultaneous edits from multiple tabs
- Rapid navigation between pages
- Rapid search queries
- Debouncing behavior

**Browser Compatibility:**
- Back/forward button navigation
- Page refresh with active session
- Tab close and reopen
- Session persistence

**Security:**
- XSS protection (script injection)
- SQL injection prevention
- HTML sanitization

**Permissions:**
- Prevent editing other families' books
- Prevent deleting other families' books
- Non-admin access to family management
- Owner-only operations

## Browser Coverage

Tests run on:
- **Chromium** (Chrome, Edge)
- **Firefox**
- **WebKit** (Safari)
- **Mobile Chrome** (Pixel 5 emulation)
- **Mobile Safari** (iPhone 12 emulation)

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      
      - name: Install dependencies
        run: |
          cd frontend
          npm install
          npx playwright install --with-deps
      
      - name: Start backend
        run: |
          cd backend
          npm install
          npm start &
          sleep 5
      
      - name: Run E2E tests
        env:
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
        run: |
          cd frontend
          npm run test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

## Writing New Tests

### Test Template

```typescript
import { test, expect, type Page } from '@playwright/test';

// Helper function for login
async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should do something', async ({ page }) => {
    await page.goto('/some-page');
    await expect(page.locator('text=Some Text')).toBeVisible();
  });
});
```

### Best Practices

1. **Use test-ids for stability**
   ```tsx
   <div data-testid="book-card">...</div>
   ```
   ```typescript
   await page.locator('[data-testid="book-card"]').click();
   ```

2. **Wait for network idle**
   ```typescript
   await page.waitForLoadState('networkidle');
   ```

3. **Handle optional elements**
   ```typescript
   const element = page.locator('button');
   const isVisible = await element.isVisible();
   if (isVisible) {
     await element.click();
   }
   ```

4. **Use timeouts for async operations**
   ```typescript
   await expect(page.locator('text=Success')).toBeVisible({ timeout: 5000 });
   ```

5. **Clean up test data**
   ```typescript
   test.afterEach(async () => {
     // Delete test data created during test
   });
   ```

## Troubleshooting

### Tests Fail on First Run
- Ensure backend server is running (`npm run dev:backend`)
- Check that test user exists in database
- Verify `.env.test` has correct credentials

### Timeout Errors
- Increase timeout in `playwright.config.ts`:
  ```typescript
  use: {
    timeout: 30000, // 30 seconds
  }
  ```

### Browser Not Found
```bash
npx playwright install
```

### Network Errors
- Ensure `http://localhost:5174` is accessible
- Check backend is running on `http://localhost:3001`
- Verify CORS settings in backend

### Element Not Found
- Add waits: `await page.waitForSelector('selector')`
- Check selectors are correct
- Use `data-testid` attributes for stability

## Coverage Report

To see which features are covered by E2E tests, run:

```bash
npm run test:e2e -- --reporter=html
npm run test:e2e:report
```

## Current Test Coverage

| Feature | Coverage | Tests |
|---------|----------|-------|
| Authentication | ✅ 100% | 19 tests |
| Books Management | ✅ 100% | 16 tests |
| Family Management | ✅ 90% | 11 tests |
| Profile | ✅ 90% | 10 tests |
| Home Dashboard | ✅ 80% | 7 tests |
| Responsive Design | ✅ 85% | 8 tests |
| Accessibility | ✅ 75% | 6 tests |
| Error Handling | ✅ 95% | 23 tests |

**Total: 100 E2E tests**

### Test Coverage Details

**Authentication (19 tests):**
- ✅ Login validation (empty, invalid, wrong password)
- ✅ Registration with new family
- ✅ Duplicate user prevention
- ✅ Shared email for multiple family members
- ✅ Password & email validation
- ✅ Logout and session management

**Error Handling (23 tests):**
- ✅ Network errors (timeout, 500, 404, retries)
- ✅ Invalid data (negative numbers, special chars, long text)
- ✅ Concurrent operations (multiple tabs, rapid actions)
- ✅ Browser compatibility (navigation, refresh, tabs)
- ✅ Security (XSS, SQL injection)
- ✅ Permissions (owner-only, admin-only)

## Next Steps

- [ ] Add tests for community search (Phase 4)
- [ ] Add tests for loans management (Phase 5)
- [ ] Add tests for reviews and ratings (Phase 6)
- [ ] Add visual regression tests
- [ ] Add performance tests
- [ ] Integrate with CI/CD pipeline

---

For more information, see [Playwright Documentation](https://playwright.dev/docs/intro).
