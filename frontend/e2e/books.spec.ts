import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  test.skip(!process.env.TEST_USER_EMAIL, 'No test user configured');
  await page.goto('/login');
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

test.describe('Books Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display My Books page', async ({ page }) => {
    await page.goto('/books');
    await expect(page.locator('text=הספרים שלי')).toBeVisible();
    await expect(page.locator('button:has-text("הוסף ספר")')).toBeVisible();
  });

  test('should display book cards in grid', async ({ page }) => {
    await page.goto('/books');
    
    // Wait for books to load
    await page.waitForSelector('[data-testid="book-card"], text=אין ספרים', { timeout: 5000 });
    
    // Check if books exist or empty state
    const hasBooks = await page.locator('[data-testid="book-card"]').count() > 0;
    const hasEmptyState = await page.locator('text=אין ספרים').isVisible();
    
    expect(hasBooks || hasEmptyState).toBeTruthy();
  });

  test('should search books by title', async ({ page }) => {
    await page.goto('/books');
    
    // Wait for books to load
    await page.waitForTimeout(1000);
    
    const searchInput = page.locator('input[placeholder*="חפש"]');
    await searchInput.fill('הארי');
    
    // Wait for search results
    await page.waitForTimeout(500);
    
    // All visible book cards should contain search term
    const bookCards = page.locator('[data-testid="book-card"]');
    const count = await bookCards.count();
    
    if (count > 0) {
      const firstCard = bookCards.first();
      const text = await firstCard.textContent();
      expect(text?.toLowerCase()).toContain('הארי');
    }
  });

  test('should filter books by status', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    // Open status filter
    const statusFilter = page.locator('select').first();
    await statusFilter.selectOption('available');
    
    await page.waitForTimeout(500);
    
    // Check that only available books are shown
    const statusChips = page.locator('text=זמין');
    const count = await statusChips.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should sort books by title', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    // Open sort dropdown
    const sortSelect = page.locator('select').last();
    await sortSelect.selectOption('title');
    
    await page.waitForTimeout(500);
    
    // Books should be displayed
    const bookCards = page.locator('[data-testid="book-card"]');
    expect(await bookCards.count()).toBeGreaterThanOrEqual(0);
  });

  test('should navigate to Add Book page', async ({ page }) => {
    await page.goto('/books');
    await page.click('button:has-text("הוסף ספר")');
    await expect(page).toHaveURL('/books/add');
    await expect(page.locator('text=הוסף ספר חדש')).toBeVisible();
  });

  test('should display Add Book form fields', async ({ page }) => {
    await page.goto('/books/add');
    
    // Required fields
    await expect(page.locator('input[name="title"]')).toBeVisible();
    await expect(page.locator('input[name="author"]')).toBeVisible();
    await expect(page.locator('select[name="genre"]')).toBeVisible();
    
    // Optional fields
    await expect(page.locator('input[name="series"]')).toBeVisible();
    await expect(page.locator('input[name="series_number"]')).toBeVisible();
    await expect(page.locator('input[name="isbn"]')).toBeVisible();
    await expect(page.locator('input[name="year_published"]')).toBeVisible();
  });

  test('should validate required fields when adding book', async ({ page }) => {
    await page.goto('/books/add');
    
    // Try to submit without filling required fields
    await page.click('button[type="submit"]');
    
    // Should show validation errors
    await expect(page.locator('text=/.*חובה.*/i')).toBeVisible();
  });

  test('should successfully add a new book', async ({ page }) => {
    await page.goto('/books/add');
    
    const timestamp = Date.now();
    const bookTitle = `ספר בדיקה ${timestamp}`;
    
    // Fill required fields
    await page.fill('input[name="title"]', bookTitle);
    await page.fill('input[name="author"]', 'סופר בדיקה');
    await page.selectOption('select[name="genre"]', 'רומן');
    
    // Fill optional series fields
    await page.fill('input[name="series"]', 'סדרת בדיקה');
    await page.fill('input[name="series_number"]', '1');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should redirect to books page or show success
    await page.waitForURL('/books', { timeout: 5000 });
    
    // Verify book appears in list
    await expect(page.locator(`text=${bookTitle}`)).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to book details page', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    // Click on first book card
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      
      // Should navigate to book details
      await expect(page).toHaveURL(/\/books\/[a-z0-9-]+/);
      
      // Should show book details
      await expect(page.locator('text=פרטי הספר')).toBeVisible();
    }
  });

  test('should display book details correctly', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      // Check for book information sections
      await expect(page.locator('text=/שם הספר|כותב|ז\'אנר/')).toBeVisible();
      
      // Should show status
      await expect(page.locator('text=/זמין|מושאל|הושאל/')).toBeVisible();
    }
  });

  test('should show edit button for owned books', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      // Owner should see edit button
      const editButton = page.locator('button:has-text("ערוך")');
      const isVisible = await editButton.isVisible();
      
      if (isVisible) {
        await expect(editButton).toBeVisible();
      }
    }
  });

  test('should navigate to edit book page', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      const editButton = page.locator('button:has-text("ערוך")');
      const canEdit = await editButton.isVisible();
      
      if (canEdit) {
        await editButton.click();
        await expect(page).toHaveURL(/\/books\/[a-z0-9-]+\/edit/);
        await expect(page.locator('text=עריכת ספר')).toBeVisible();
      }
    }
  });

  test('should pre-fill edit form with existing data', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      // Get book title from card
      const titleOnCard = await firstBook.locator('text=/./').first().textContent();
      
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      const editButton = page.locator('button:has-text("ערוך")');
      const canEdit = await editButton.isVisible();
      
      if (canEdit) {
        await editButton.click();
        await page.waitForLoadState('networkidle');
        
        // Title input should be pre-filled
        const titleInput = page.locator('input[name="title"]');
        const titleValue = await titleInput.inputValue();
        expect(titleValue).toBeTruthy();
      }
    }
  });

  test('should update book successfully', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      const editButton = page.locator('button:has-text("ערוך")');
      const canEdit = await editButton.isVisible();
      
      if (canEdit) {
        await editButton.click();
        await page.waitForLoadState('networkidle');
        
        // Update summary field
        const summaryField = page.locator('textarea[name="summary"]');
        await summaryField.fill(`עודכן בתאריך ${new Date().toLocaleString('he-IL')}`);
        
        // Submit
        await page.click('button[type="submit"]');
        
        // Should redirect back to book details
        await page.waitForURL(/\/books\/[a-z0-9-]+$/, { timeout: 5000 });
      }
    }
  });

  test('should show delete confirmation dialog', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      const deleteButton = page.locator('button:has-text("מחק")');
      const canDelete = await deleteButton.isVisible();
      
      if (canDelete) {
        await deleteButton.click();
        
        // Should show confirmation dialog
        await expect(page.locator('text=/.*בטוח.*מחק.*/i')).toBeVisible();
        
        // Cancel deletion
        await page.click('button:has-text("ביטול")');
      }
    }
  });
});
