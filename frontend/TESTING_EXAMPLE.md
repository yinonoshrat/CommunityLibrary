# Example: Running Your First E2E Test

This is a step-by-step walkthrough for running your first Playwright test.

## Step 1: Install and Setup

```bash
# Navigate to frontend folder
cd frontend

# Install dependencies (if not done yet)
npm install

# Install Playwright browsers
npx playwright install
```

## Step 2: Create Test User

**IMPORTANT:** Tests now automatically create users during testing! 

However, for manual testing, you can create a test user:

1. Go to your app: `http://localhost:5174`
2. Click "הרשמה" (Register)
3. Create a new account with:
   - Email: `test@example.com`
   - Password: `Test123!@#`
   - Name: `Test User`
   - Phone: `050-1234567`
   - Family: Create new family or join existing

**Note:** The new test suite includes automated user creation tests that:
- ✅ Create unique users for each test run
- ✅ Test duplicate user prevention
- ✅ Test shared email for family members
- ✅ Validate all registration fields

## Step 3: Configure Environment

```bash
# Create .env.test file
cp .env.test.example .env.test

# Edit .env.test and add:
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=Test123!@#
```

## Step 4: Start Services

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## Step 5: Run Tests with UI

**Terminal 3 - Tests:**
```bash
cd frontend
npm run test:e2e:ui
```

This opens Playwright Test UI where you can:

1. **See all test files** on the left sidebar
2. **Click on any test** to see details
3. **Click the green play button** to run a test
4. **Watch the test execute** in real-time
5. **See results** - green checkmark = passed, red X = failed

## Step 6: Try Running Specific Tests

### Run only authentication tests:
```bash
npx playwright test auth.spec.ts
```

### Run only one specific test:
```bash
npx playwright test -g "should display login page"
```

### Run in headed mode (see browser):
```bash
npm run test:e2e:headed
```

## Step 7: View Results

After running tests, view the HTML report:

```bash
npm run test:e2e:report
```

This opens a detailed report showing:
- Which tests passed/failed
- Screenshots of failures
- Execution time
- Error messages

## Example Test Run Output

```
Running 100 tests using 4 workers

  ✓ auth.spec.ts:15:7 › Login › should display login page (1.2s)
  ✓ auth.spec.ts:22:7 › Login › should show error for empty credentials (2.1s)
  ✓ auth.spec.ts:30:7 › Login › should show error for invalid email (2.3s)
  ✓ auth.spec.ts:95:7 › Registration › should create new user (4.5s)
  ✓ auth.spec.ts:128:7 › Registration › should prevent duplicate users (5.2s)
  ✓ books.spec.ts:15:7 › should display My Books page (1.5s)
  ✓ books.spec.ts:22:7 › should display book cards in grid (1.8s)
  ✓ errors.spec.ts:10:7 › Network › should handle timeout (31.2s)
  ✓ errors.spec.ts:25:7 › Network › should handle 500 error (2.1s)
  ...

  100 passed (3.8m)
```

## Debugging a Failing Test

If a test fails:

1. **Run with debug mode:**
   ```bash
   npm run test:e2e:debug
   ```

2. **Check the error message** in the output

3. **Look at the screenshot** in `test-results/` folder

4. **Run just that test:**
   ```bash
   npx playwright test -g "name of failing test"
   ```

## Common First-Time Issues

### ❌ Issue: "No test user configured"
**Solution:** Make sure `.env.test` exists with correct credentials

### ❌ Issue: "Timeout waiting for locator"
**Cause:** Element not found or page didn't load
**Solution:** 
- Check if app is running on `http://localhost:5174`
- Check if backend is running on `http://localhost:3001`
- Try increasing timeout in test

### ❌ Issue: "Test user login failed"
**Cause:** Wrong credentials or user doesn't exist
**Solution:**
- Verify test user exists in database
- Check credentials in `.env.test`
- Try logging in manually with those credentials

### ❌ Issue: Browser crashes
**Solution:**
```bash
npx playwright install --force
```

## Next Steps

1. ✅ Run all tests with UI mode
2. ✅ Check the test report
3. ✅ Read `E2E_TESTING.md` for detailed docs
4. ✅ Try writing a simple test
5. ✅ Add `data-testid` to your components

## Writing Your First Test

Create `frontend/e2e/my-first-test.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('my first test', async ({ page }) => {
  // Navigate to app
  await page.goto('http://localhost:5174');
  
  // Check that login page loads
  await expect(page.locator('text=התחברות')).toBeVisible();
  
  // Fill in email
  await page.fill('input[name="email"]', 'test@example.com');
  
  // Check that email was filled
  const email = await page.inputValue('input[name="email"]');
  expect(email).toBe('test@example.com');
});
```

Run it:
```bash
npx playwright test my-first-test.spec.ts
```

## Resources

- **Playwright Docs:** https://playwright.dev/
- **Selectors Guide:** https://playwright.dev/docs/selectors
- **Best Practices:** https://playwright.dev/docs/best-practices
- **Full Test Docs:** See `E2E_TESTING.md`

---

**Happy Testing! 🎭**
