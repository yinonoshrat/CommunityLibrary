# Quick Start: Running E2E Tests

## Prerequisites

1. **Install Playwright** (if not already installed):
```bash
cd frontend
npm install
npx playwright install
```

2. **Create test environment file**:
```bash
cd frontend
cp .env.test.example .env.test
```

3. **Edit `.env.test`** and add your test user credentials:
```env
TEST_USER_EMAIL=your-test-email@example.com
TEST_USER_PASSWORD=your-test-password
```

## Running Tests

### Option 1: Run all tests (recommended for first time)
```bash
cd frontend
npm run test:e2e:ui
```
This opens Playwright's interactive UI where you can:
- See all tests
- Run tests one by one
- Watch tests execute in real-time
- Debug failures

### Option 2: Run all tests in headless mode
```bash
cd frontend
npm run test:e2e
```
Fast execution without UI. Good for CI/CD.

### Option 3: Run specific test file
```bash
cd frontend
npx playwright test books.spec.ts
```

### Option 4: Debug a failing test
```bash
cd frontend
npm run test:e2e:debug
```
Opens debugger with step-by-step execution.

## Test Files

| File | Tests | Features Covered |
|------|-------|------------------|
| `auth.spec.ts` | 19 | Login, Register, Validation, Duplicate Prevention, Shared Email |
| `books.spec.ts` | 16 | Add/Edit/Delete Books, Search, Filters, Series |
| `family.spec.ts` | 11 | Family Dashboard, Members List, Admin Features |
| `profile.spec.ts` | 10 | Profile View/Edit, Home Dashboard |
| `responsive.spec.ts` | 8 | Mobile/Tablet Layout, RTL, Accessibility |
| `errors.spec.ts` | 23 | Network Errors, Validation, Security, Permissions |

**Total: 100 tests**

## View Test Report

After running tests:
```bash
cd frontend
npm run test:e2e:report
```

## Common Issues

### ❌ "No test user configured"
**Solution:** Add credentials to `.env.test`

### ❌ "Cannot connect to localhost:5174"
**Solution:** Start dev server in another terminal:
```bash
cd frontend
npm run dev
```

### ❌ "Cannot connect to localhost:3001"
**Solution:** Start backend in another terminal:
```bash
cd backend
npm start
```

### ❌ Browser not installed
**Solution:**
```bash
npx playwright install
```

## Tips

- **Run tests on specific browser only:**
  ```bash
  npx playwright test --project=chromium
  ```

- **Run tests matching pattern:**
  ```bash
  npx playwright test -g "should add book"
  ```

- **Run tests in headed mode (see browser):**
  ```bash
  npm run test:e2e:headed
  ```

## Next Steps

1. Run tests with UI mode first to see what they do
2. Check the HTML report to see coverage
3. Read `E2E_TESTING.md` for detailed documentation
4. Add test-ids to new components for easier testing

---

**Need help?** See `frontend/E2E_TESTING.md` for full documentation.
