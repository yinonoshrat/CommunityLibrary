import { test, expect } from '@playwright/test';

async function login(page: any) {
  test.skip(!process.env.TEST_USER_EMAIL, 'No test user configured');
  await page.goto('/login');
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

test.describe('Book Details & Loan Request', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display book details', async ({ page }) => {
    // Go to search page to find a book
    await page.goto('/search');
    
    // Wait for books to load
    await page.waitForSelector('[data-testid="book-card"]', { timeout: 10000 });
    
    // Click on the first book
    await page.locator('[data-testid="book-card"]').first().click();
    
    // Verify URL changes to /books/:id
    await expect(page).toHaveURL(/\/books\/[a-f0-9-]+/);
    
    // Verify details are shown
    // Assuming title is h1 or h2
    await expect(page.locator('h1, h2').first()).toBeVisible(); 
    // Verify author label (Hebrew)
    await expect(page.locator('text=מחבר')).toBeVisible();
  });

  test('should show loan request button or status', async ({ page }) => {
    await page.goto('/search');
    await page.waitForSelector('[data-testid="book-card"]', { timeout: 10000 });
    await page.locator('[data-testid="book-card"]').first().click();
    
    // Check for status indicator
    await expect(page.locator('text=סטטוס')).toBeVisible();
    
    // Check for action buttons (Edit if owner, Request if not)
    const actionButton = page.locator('button').filter({ hasText: /ערוך|בקש|השאלה/ });
    await expect(actionButton.first()).toBeVisible();
  });
});
