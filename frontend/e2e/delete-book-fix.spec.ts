import { test, expect, type Page } from '@playwright/test';

// Helper function to generate unique user data
function generateUserData() {
  const timestamp = Date.now();
  return {
    name: `Test User ${timestamp}`,
    email: `user${timestamp}@example.com`,
    password: 'Test1234!',
    phone: '0501234567',
    familyName: `Family ${timestamp}`
  };
}

// Helper function to register a new user
async function registerUser(page: Page, userData: any) {
  await page.goto('/register');
  
  await page.fill('input[name="name"]', userData.name);
  await page.fill('input[name="email"]', userData.email);
  await page.fill('input[name="password"]', userData.password);
  await page.getByLabel('אימות סיסמה').fill(userData.password);
  await page.fill('input[name="phone"]', userData.phone);
  await page.fill('input[name="familyName"]', userData.familyName);
  
  await page.click('[data-testid="submit-button"]');
  await page.waitForURL('/login');
}

// Helper function for login
async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  
  // Step 1: Email
  await page.fill('input[name="email"]', email);
  await page.click('[data-testid="submit-button"]');
  
  // Step 2: Password
  await page.waitForSelector('input[name="password"]', { timeout: 10000 });
  await page.fill('input[name="password"]', password);
  await page.click('[data-testid="submit-button"]');
  
  await page.waitForURL('/', { timeout: 10000 });
}

test.describe('Delete Book Fix', () => {
  let userData: any;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120000);
    userData = generateUserData();
    await registerUser(page, userData);
    await login(page, userData.email, userData.password);
  });

  test('should remove book from My Books (הספרים שלי) immediately after deletion', async ({ page }) => {
    // 1. Add a book (need to switch to single book mode first)
    const bookTitle = `Delete Test Book ${Date.now()}`;
    await page.goto('/books/add');
    await page.waitForLoadState('networkidle');
    
    // Switch to single book mode (default is bulk/AI mode)
    await page.getByLabel('single book').click();
    await page.waitForLoadState('networkidle');
    
    // Wait for form to be ready
    await page.waitForSelector('form');
    
    // Fill required fields
    await page.locator('input[name="title"]').fill(bookTitle);
    await page.locator('input[name="author"]').fill('Test Author');
    
    // Genre is required - select one using MUI Select
    await page.getByLabel("ז'אנר").click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: 'רומן' }).click();
    await page.waitForTimeout(500);
    
    // Submit the form
    await page.getByRole('button', { name: 'שמור ספר' }).click();
    
    // Wait for success message and redirect to books list
    await expect(page.getByText('הספר נוסף בהצלחה')).toBeVisible({ timeout: 15000 });
    await page.waitForURL('/books', { timeout: 10000 });
    
    // 2. Verify book is visible in the list after creation
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.getByText(bookTitle)).toBeVisible({ timeout: 15000 });
    
    // 3. Click on the book to go to details page
    await page.getByText(bookTitle).first().click();
    await expect(page).toHaveURL(/\/books\/[a-f0-9-]+/, { timeout: 10000 });
    const bookUrl = page.url();
    // Extract just the UUID, removing any query params
    const bookId = bookUrl.split('/books/')[1].split('?')[0];
    await page.waitForLoadState('networkidle');

    // 4. Delete the book
    console.log('About to click delete button');
    await page.getByRole('button', { name: 'מחק ספר' }).click();
    // Wait for confirmation dialog
    console.log('Waiting for dialog');
    await expect(page.getByRole('dialog')).toBeVisible();
    console.log('Dialog visible, clicking confirm');
    
    // Listen for network requests to verify delete is called
    const deletePromise = page.waitForRequest(request => 
      request.method() === 'DELETE' && request.url().includes('/api/books/')
    );
    
    // Capture console logs
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('[Delete]') || msg.text().includes('[MyBooks]')) {
        consoleLogs.push(msg.text());
      }
    });
    
    await page.getByRole('button', { name: 'מחק', exact: true }).click();
    console.log('Clicked confirm button');
    
    // Wait for DELETE request to complete
    try {
      const deleteRequest = await deletePromise;
      console.log('DELETE request URL:', deleteRequest.url());
      const response = await deleteRequest.response();
      console.log('DELETE response status:', response?.status());
    } catch (e) {
      console.log('No DELETE request captured');
    }
    
    // Wait a bit for console logs to be captured
    await page.waitForTimeout(500);
    console.log('Console logs:', consoleLogs);

    // 5. Verify redirect to books page (may have query params)
    await page.waitForURL(/\/books/, { timeout: 10000 });
    
    // 5.5. Verify API returns 404 for the deleted book (proves server-side deletion worked)
    // Use the browser's fetch to ensure we have the same auth context
    console.log('Checking book ID:', bookId);
    const checkResult = await page.evaluate(async (id) => {
      const response = await fetch(`/api/books/${id}`);
      return { status: response.status, ok: response.ok };
    }, bookId);
    console.log('API response status (browser):', checkResult.status);
    expect(checkResult.status).toBe(404);
    
    // 6. Verify book is NOT visible immediately after deletion (the main bug fix)
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page.getByText(bookTitle)).not.toBeVisible({ timeout: 5000 });
    
    // 7. Verify book is gone after page reload (cache fully cleared)
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(bookTitle)).not.toBeVisible({ timeout: 5000 });
  });

  test('should also remove associated loans when book is deleted', async ({ page, browser }) => {
    // This test verifies that deleting a loaned book also removes the loan
    
    // 1. Add a book (need to switch to single book mode first)
    const bookTitle = `Loaned Book ${Date.now()}`;
    await page.goto('/books/add');
    await page.waitForLoadState('networkidle');
    
    // Switch to single book mode (default is bulk/AI mode)
    await page.getByLabel('single book').click();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('form');
    
    // Fill required fields
    await page.locator('input[name="title"]').fill(bookTitle);
    await page.locator('input[name="author"]').fill('Author');
    
    // Genre is required
    await page.getByLabel("ז'אנר").click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: 'רומן' }).click();
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: 'שמור ספר' }).click();
    
    // Wait for success and redirect
    await expect(page.getByText('הספר נוסף בהצלחה')).toBeVisible({ timeout: 15000 });
    await page.waitForURL('/books', { timeout: 10000 });
    
    // Click on the book to go to details page
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.getByText(bookTitle).first().click();
    await expect(page).toHaveURL(/\/books\/[a-f0-9-]+/, { timeout: 10000 });
    const bookUrl = page.url();
    
    // 2. Register borrower in separate context
    const borrowerData = generateUserData();
    const borrowerContext = await browser.newContext();
    const borrowerPage = await borrowerContext.newPage();
    
    await registerUser(borrowerPage, borrowerData);
    await login(borrowerPage, borrowerData.email, borrowerData.password);
    
    // 3. Owner creates a loan to borrower
    await page.goto(bookUrl);
    await page.waitForLoadState('networkidle');
    
    // Click "Lend Book" button (השאל ספר)
    await page.getByRole('button', { name: 'השאל ספר' }).click();
    
    // Wait for loan dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Wait for families dropdown to load - wait until the submit button is not disabled
    // (indicates families have loaded)
    await page.waitForTimeout(2000);
    
    // Select borrower family from MUI Select dropdown using combobox role
    await page.getByRole('combobox').click();
    await page.waitForTimeout(500);
    
    // Select the borrower's family from the dropdown options
    await page.getByRole('option', { name: new RegExp(borrowerData.familyName) }).click();
    await page.waitForTimeout(500);
    
    // Click create loan button (button text is "השאל")
    await page.getByRole('button', { name: 'השאל' }).click();
    
    // Wait for loan to be created
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
    
    // 4. Verify loan appears in borrower's loans dashboard
    await borrowerPage.goto('/loans');
    await borrowerPage.waitForLoadState('networkidle');
    // Click on "שאלתי" (Borrowed) tab since borrower is viewing borrowed books
    await borrowerPage.getByRole('tab', { name: 'שאלתי', exact: true }).click();
    await borrowerPage.waitForLoadState('networkidle');
    await borrowerPage.waitForTimeout(1000);
    await expect(borrowerPage.getByText(bookTitle)).toBeVisible({ timeout: 10000 });
    
    // 5. Owner deletes the book (with active loan)
    await page.goto(bookUrl);
    await page.waitForLoadState('networkidle');
    
    // Delete button
    await page.getByRole('button', { name: 'מחק ספר' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'מחק', exact: true }).click();
    
    // Verify redirect
    await page.waitForURL('/books', { timeout: 10000 });
    
    // 6. Verify book is removed from owner's view
    await page.goto('/books?view=my');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(bookTitle)).not.toBeVisible({ timeout: 5000 });
    
    // 7. Verify loan is removed from borrower's loans (CASCADE delete)
    await borrowerPage.goto('/loans');
    await borrowerPage.waitForLoadState('networkidle');
    // Click on "שאלתי" (Borrowed) tab
    await borrowerPage.getByRole('tab', { name: 'שאלתי', exact: true }).click();
    await borrowerPage.waitForLoadState('networkidle');
    await borrowerPage.reload();
    await borrowerPage.waitForLoadState('networkidle');
    await borrowerPage.getByRole('tab', { name: 'שאלתי', exact: true }).click();
    await borrowerPage.waitForTimeout(1000);
    await expect(borrowerPage.getByText(bookTitle)).not.toBeVisible({ timeout: 10000 });
    
    await borrowerContext.close();
  });
});
