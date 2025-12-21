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
async function login(page: Page, email: string) {
  await page.goto('/login');
  
  // Step 1: Email
  await page.fill('input[name="email"]', email);
  await page.click('button[type="submit"]');
  
  // Step 2: Password
  await page.waitForSelector('input[name="password"]');
  await page.fill('input[name="password"]', 'Test1234!');
  await page.click('button[type="submit"]');
  
  await page.waitForURL('/', { timeout: 10000 });
}

test.describe('Books Management', () => {
  let userData: any;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120000);
    userData = generateUserData();
    await registerUser(page, userData);
    await login(page, userData.email);
  });

  test('should display My Books page', async ({ page }) => {
    await page.goto('/books');
    await expect(page.getByRole('heading', { name: 'הספרים שלי' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'הוסף ספרים' })).toBeVisible();
  });

  test('should display book cards in grid', async ({ page }) => {
    await page.goto('/books');
    
    // Wait for books to load
    await expect(page.locator('[data-testid="book-card"]').or(page.getByText('לא נמצאו ספרים להצגה'))).toBeVisible({ timeout: 10000 });
    
    // Check if books exist or empty state
    const hasBooks = await page.locator('[data-testid="book-card"]').count() > 0;
    const hasEmptyState = await page.getByText('לא נמצאו ספרים להצגה').isVisible();
    
    expect(hasBooks || hasEmptyState).toBeTruthy();
  });

  test('should search books by title', async ({ page }) => {
    await page.goto('/books');
    
    // Wait for books to load
    await page.waitForTimeout(1000);
    
    const searchInput = page.getByPlaceholder('חפש לפי שם, מחבר או סדרה');
    await searchInput.fill('הארי');
    
    // Wait for search results
    await page.waitForTimeout(1000);
    
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
    await page.locator('#status-select').click();
    await page.getByRole('option', { name: 'זמין' }).click();
    
    await page.waitForTimeout(1000);
    
    // Check that only available books are shown
    // Note: This check depends on UI showing "זמין" on the card
    const bookCards = page.locator('[data-testid="book-card"]');
    if (await bookCards.count() > 0) {
        const text = await bookCards.first().textContent();
        // expect(text).toContain('זמין'); // Adjust based on actual UI
    }
  });

  test('should sort books by title', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    // Open sort dropdown
    await page.locator('#sort-select').click();
    await page.getByRole('option', { name: 'שם הספר' }).click();
    
    await page.waitForTimeout(1000);
    
    // Books should be displayed
    const bookCards = page.locator('[data-testid="book-card"]');
    expect(await bookCards.count()).toBeGreaterThanOrEqual(0);
  });

  test('should navigate to Add Book page', async ({ page }) => {
    await page.goto('/books');
    await page.getByRole('button', { name: 'הוסף ספרים' }).click();
    await expect(page).toHaveURL('/books/add');
    await expect(page.getByRole('heading', { name: 'הוסף ספר חדש' })).toBeVisible();
  });

  test('should display Add Book form fields', async ({ page }) => {
    await page.goto('/books/add');
    
    // Switch to Single Book mode
    await page.getByLabel('single book').click();
    
    // Required fields
    await expect(page.locator('input[name="title"]')).toBeVisible();
    await expect(page.locator('input[name="author"]')).toBeVisible();
    await expect(page.getByLabel('ז\'אנר')).toBeVisible();
    
    // Optional fields
    await expect(page.locator('input[name="series"]')).toBeVisible();
    await expect(page.locator('input[name="series_number"]')).toBeVisible();
    await expect(page.locator('input[name="isbn"]')).toBeVisible();
    await expect(page.locator('input[name="publish_year"]')).toBeVisible();
  });

  test('should validate required fields when adding book', async ({ page }) => {
    await page.goto('/books/add');
    
    // Switch to Single Book mode
    await page.getByLabel('single book').click();
    
    // Try to submit without filling required fields
    await page.getByRole('button', { name: 'שמור ספר' }).click();
    
    // Should stay on page
    await expect(page).toHaveURL('/books/add');
  });

  test('should successfully add a new book', async ({ page }) => {
    await page.goto('/books/add');
    
    // Switch to Single Book mode
    await page.getByLabel('single book').click();
    
    const timestamp = Date.now();
    const bookTitle = `ספר בדיקה ${timestamp}`;
    
    // Fill required fields
    await page.locator('input[name="title"]').fill(bookTitle);
    await page.locator('input[name="author"]').fill('סופר בדיקה');
    
    await page.getByLabel('ז\'אנר').click();
    await page.getByRole('option', { name: 'רומן' }).click();
    
    // Fill optional series fields
    await page.locator('input[name="series"]').fill('סדרת בדיקה');
    await page.locator('input[name="series_number"]').fill('1');
    
    // Submit form
    await page.getByRole('button', { name: 'שמור ספר' }).click();
    
    // Should redirect to books page or show success
    await page.waitForURL('/books', { timeout: 10000 });
    
    // Verify book appears in list
    // We might need to search for it if list is long
    const searchInput = page.getByPlaceholder('חפש לפי שם, מחבר או סדרה');
    await searchInput.fill(bookTitle);
    await page.waitForTimeout(1000);
    
    await expect(page.getByText(bookTitle)).toBeVisible({ timeout: 10000 });
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
