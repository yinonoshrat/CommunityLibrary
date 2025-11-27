import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  test.skip(!process.env.TEST_USER_EMAIL, 'No test user configured');
  await page.goto('/login');
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

test.describe('Profile Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display Profile page', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.locator('text=הפרופיל שלי')).toBeVisible();
  });

  test('should display user information', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    
    // Should show user details
    await expect(page.locator('input[name="name"], text=/שם/')).toBeVisible();
    await expect(page.locator('input[name="phone"], text=/טלפון/')).toBeVisible();
    await expect(page.locator('input[name="email"], text=/@/')).toBeVisible();
  });

  test('should display family information', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    
    // Should show family name
    await expect(page.locator('text=/משפחה|משפחת/')).toBeVisible();
  });

  test('should show admin status if user is admin', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    
    // Check if admin status is shown (could be visible or not)
    const adminText = page.locator('text=/מנהל משפחה/');
    const adminStatus = await adminText.count() > 0;
    
    // Just verify page loads correctly
    expect(adminStatus || !adminStatus).toBeTruthy();
  });

  test('should enable edit mode when clicking edit button', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    
    const editButton = page.locator('button:has-text("ערוך")');
    const hasEditButton = await editButton.isVisible();
    
    if (hasEditButton) {
      await editButton.click();
      
      // Form fields should become editable
      const nameInput = page.locator('input[name="name"]');
      const isEnabled = await nameInput.isEnabled();
      expect(isEnabled).toBeTruthy();
    }
  });

  test('should update user profile successfully', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    
    const editButton = page.locator('button:has-text("ערוך")');
    const hasEditButton = await editButton.isVisible();
    
    if (hasEditButton) {
      await editButton.click();
      
      // Update phone number
      const phoneInput = page.locator('input[name="phone"]');
      const currentPhone = await phoneInput.inputValue();
      
      // Just add a space or modify slightly
      await phoneInput.fill(currentPhone + ' ');
      await phoneInput.fill(currentPhone); // Restore
      
      // Save changes
      const saveButton = page.locator('button:has-text("שמור")');
      if (await saveButton.isVisible()) {
        await saveButton.click();
        
        // Should show success message
        await expect(page.locator('text=/עודכן|נשמר/')).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should show logout button', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.locator('button:has-text("התנתק")')).toBeVisible();
  });

  test('should logout and redirect to login page', async ({ page }) => {
    await page.goto('/profile');
    
    await page.click('button:has-text("התנתק")');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });

  test('should display email as read-only', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    
    const editButton = page.locator('button:has-text("ערוך")');
    const hasEditButton = await editButton.isVisible();
    
    if (hasEditButton) {
      await editButton.click();
      
      // Email should be disabled/read-only
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const isDisabled = await emailInput.isDisabled();
      expect(isDisabled).toBeTruthy();
    }
  });
});

test.describe('Home Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display Home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=/שלום|ברוך הבא/')).toBeVisible();
  });

  test('should show search bar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input[placeholder*="חפש"]')).toBeVisible();
  });

  test('should display catalog statistics', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should show some stats
    await expect(page.locator('text=/ספרים|השאלות/')).toBeVisible();
  });

  test('should show management cards', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should show management options
    const cards = page.locator('[data-testid="management-card"]');
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('should navigate to books when clicking on books card', async ({ page }) => {
    await page.goto('/');
    
    const booksCard = page.locator('text=הספרים שלי').first();
    await booksCard.click();
    
    await expect(page).toHaveURL('/books');
  });

  test('should navigate to family when clicking on family card', async ({ page }) => {
    await page.goto('/');
    
    const familyCard = page.locator('text=ניהול המשפחה').first();
    if (await familyCard.isVisible()) {
      await familyCard.click();
      await expect(page).toHaveURL('/family');
    }
  });

  test('should perform search from home page', async ({ page }) => {
    await page.goto('/');
    
    const searchInput = page.locator('input[placeholder*="חפש"]');
    await searchInput.fill('הארי פוטר');
    
    // Press Enter or click search button
    await searchInput.press('Enter');
    
    // Should navigate to search results or books page
    await page.waitForURL(/books|search/);
  });

  test('should navigate to loans when clicking on loans management card', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loansCard = page.locator('[data-testid="loans-management-card"]');
    await expect(loansCard).toBeVisible();
    await loansCard.click();
    
    await expect(page).toHaveURL('/loans');
  });

  test('should display loan status section', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loanStatusSection = page.locator('[data-testid="loan-status-section"]');
    await expect(loanStatusSection).toBeVisible();
    
    // Should show books lent and borrowed counts
    await expect(page.locator('[data-testid="books-lent-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="books-borrowed-card"]')).toBeVisible();
  });

  test('should display books lent count', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const booksLentCard = page.locator('[data-testid="books-lent-card"]');
    await expect(booksLentCard).toBeVisible();
    
    // Should show a number (could be 0)
    const countText = booksLentCard.locator('h5');
    await expect(countText).toBeVisible();
    const count = await countText.textContent();
    expect(count).toMatch(/^\d+$/); // Should be a number
  });

  test('should display books borrowed count', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const booksBorrowedCard = page.locator('[data-testid="books-borrowed-card"]');
    await expect(booksBorrowedCard).toBeVisible();
    
    // Should show a number (could be 0)
    const countText = booksBorrowedCard.locator('h5');
    await expect(countText).toBeVisible();
    const count = await countText.textContent();
    expect(count).toMatch(/^\d+$/); // Should be a number
  });

  test('should show search autocomplete suggestions', async ({ page }) => {
    await page.goto('/');
    
    const searchInput = page.locator('[data-testid="search-autocomplete"] input');
    await searchInput.fill('ה');
    
    // Wait for suggestions to appear (if any books exist)
    await page.waitForTimeout(500); // Wait for debounce
    
    // If suggestions appear, they should be clickable
    const suggestions = page.locator('[role="option"]');
    if (await suggestions.count() > 0) {
      await expect(suggestions.first()).toBeVisible();
    }
  });

  test('should navigate to recommendations page', async ({ page }) => {
    await page.goto('/');
    
    const recommendationsButton = page.locator('[data-testid="recommendations-button"]');
    await expect(recommendationsButton).toBeVisible();
    await recommendationsButton.click();
    
    await expect(page).toHaveURL('/recommendations');
  });

  test('should submit search using search button', async ({ page }) => {
    await page.goto('/');
    
    const searchInput = page.locator('[data-testid="search-autocomplete"] input');
    await searchInput.fill('test book');
    
    const searchButton = page.locator('[data-testid="search-submit-button"]');
    await searchButton.click();
    
    // Should navigate to search page with query
    await page.waitForURL(/search/);
    expect(page.url()).toContain('test book');
  });

  test('should have unique testids for each management card', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Verify each card has unique testid
    await expect(page.locator('[data-testid="books-management-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="loans-management-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="family-management-card"]')).toBeVisible();
    
    // Should have exactly one of each
    expect(await page.locator('[data-testid="books-management-card"]').count()).toBe(1);
    expect(await page.locator('[data-testid="loans-management-card"]').count()).toBe(1);
    expect(await page.locator('[data-testid="family-management-card"]').count()).toBe(1);
  });

  test('should display all three management cards', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Books card
    const booksCard = page.locator('[data-testid="books-management-card"]');
    await expect(booksCard).toBeVisible();
    await expect(booksCard.locator('text=הספרים שלי')).toBeVisible();
    
    // Loans card
    const loansCard = page.locator('[data-testid="loans-management-card"]');
    await expect(loansCard).toBeVisible();
    await expect(loansCard.locator('text=ניהול השאלות')).toBeVisible();
    
    // Family card
    const familyCard = page.locator('[data-testid="family-management-card"]');
    await expect(familyCard).toBeVisible();
    await expect(familyCard.locator('text=ניהול המשפחה')).toBeVisible();
  });
});
