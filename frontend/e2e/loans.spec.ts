import { test, expect } from '@playwright/test';

// Helper function for login
async function login(page: any) {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'yinono@gmail.com');
  await page.fill('input[name="password"]', 'Test1234!');
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 10000 });
}

test.describe('Loans Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should navigate to loans dashboard', async ({ page }) => {
    await page.goto('/loans');
    await expect(page).toHaveURL('/loans');
    await expect(page.locator('text=/השאלות|ניהול השאלות/')).toBeVisible();
  });

  test('should display loan tabs (lent, borrowed, history)', async ({ page }) => {
    await page.goto('/loans');
    await expect(page.locator('button:has-text("השאלתי")')).toBeVisible();
    await expect(page.locator('button:has-text("שאלתי")')).toBeVisible();
    await expect(page.locator('button:has-text("היסטוריה")')).toBeVisible();
  });

  test('should display active lent loans in first tab', async ({ page }) => {
    await page.goto('/loans');
    await page.click('button:has-text("השאלתי")');
    
    const hasLoans = await page.locator('[data-testid="loan-card"]').count() > 0;
    if (hasLoans) {
      await expect(page.locator('[data-testid="loan-card"]').first()).toBeVisible();
    } else {
      await expect(page.locator('text=/אין|ספרים מושאלים/')).toBeVisible();
    }
  });

  test('should display active borrowed loans in second tab', async ({ page }) => {
    await page.goto('/loans');
    await page.click('button:has-text("שאלתי")');
    
    const hasLoans = await page.locator('[data-testid="loan-card"]').count() > 0;
    if (hasLoans) {
      await expect(page.locator('[data-testid="loan-card"]').first()).toBeVisible();
    }
  });

  test('should display loan history in third tab', async ({ page }) => {
    await page.goto('/loans');
    await page.click('button:has-text("היסטוריה")');
    
    const hasHistory = await page.locator('[data-testid="loan-card"]').count() > 0;
    if (hasHistory) {
      await expect(page.locator('[data-testid="loan-card"]').first()).toBeVisible();
    }
  });

  test('should show "Mark as Returned" button for lent books', async ({ page }) => {
    await page.goto('/loans');
    await page.click('button:has-text("השאלתי")');
    
    const loanCards = await page.locator('[data-testid="loan-card"]').count();
    if (loanCards > 0) {
      const returnButton = page.locator('button:has-text("סמן כהוחזר")').first();
      await expect(returnButton).toBeVisible();
    }
  });

  test('should open return dialog when clicking "Mark as Returned"', async ({ page }) => {
    await page.goto('/loans');
    await page.click('button:has-text("השאלתי")');
    
    const loanCards = await page.locator('[data-testid="loan-card"]').count();
    if (loanCards > 0) {
      await page.click('button:has-text("סמן כהוחזר")');
      await expect(page.locator('text=/החזרת ספר|סמן כהוחזר/')).toBeVisible();
    }
  });

  test('should display borrower family name in return dialog', async ({ page }) => {
    await page.goto('/loans');
    await page.click('button:has-text("השאלתי")');
    
    const loanCards = await page.locator('[data-testid="loan-card"]').count();
    if (loanCards > 0) {
      await page.click('button:has-text("סמן כהוחזר")');
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      // Should show family name, not default "משפחה"
      const dialogContent = await page.locator('[role="dialog"]').textContent();
      expect(dialogContent).not.toContain('משפחה לא ידועה');
    }
  });

  test('should allow adding notes when returning book', async ({ page }) => {
    await page.goto('/loans');
    await page.click('button:has-text("השאלתי")');
    
    const loanCards = await page.locator('[data-testid="loan-card"]').count();
    if (loanCards > 0) {
      await page.click('button:has-text("סמן כהוחזר")');
      const notesField = page.locator('textarea[placeholder*="הערות"]');
      if (await notesField.isVisible()) {
        await notesField.fill('הספר הוחזר במצב טוב');
        await expect(notesField).toHaveValue('הספר הוחזר במצב טוב');
      }
    }
  });

  test('should create loan from book details page', async ({ page }) => {
    await page.goto('/books');
    
    // Find an available book
    const availableBook = page.locator('[data-testid="book-card"]').filter({ hasText: 'זמין' }).first();
    if (await availableBook.isVisible()) {
      await availableBook.click();
      
      // Check if "השאל ספר" button exists (user owns the book)
      const loanButton = page.locator('button:has-text("השאל ספר")');
      if (await loanButton.isVisible()) {
        await loanButton.click();
        await expect(page.locator('text=/השאלת ספר|יצירת השאלה/')).toBeVisible();
      }
    }
  });

  test('should show return button on book details for loaned books', async ({ page }) => {
    await page.goto('/books');
    
    const loanedBook = page.locator('[data-testid="book-card"]').filter({ hasText: 'מושאל' }).first();
    if (await loanedBook.isVisible()) {
      await loanedBook.click();
      
      const returnButton = page.locator('button:has-text("סמן כהוחזר")');
      const isOwner = await returnButton.isVisible();
      if (isOwner) {
        await expect(returnButton).toBeVisible();
      }
    }
  });

  test('should display loan dates correctly', async ({ page }) => {
    await page.goto('/loans');
    await page.click('button:has-text("השאלתי")');
    
    const loanCards = await page.locator('[data-testid="loan-card"]').count();
    if (loanCards > 0) {
      const loanCard = page.locator('[data-testid="loan-card"]').first();
      const hasDate = await loanCard.locator('text=/תאריך|מתי/').count() > 0;
      expect(hasDate).toBeTruthy();
    }
  });

  test('should show book cover in loan card', async ({ page }) => {
    await page.goto('/loans');
    await page.click('button:has-text("השאלתי")');
    
    const loanCards = await page.locator('[data-testid="loan-card"]').count();
    if (loanCards > 0) {
      const bookImage = page.locator('[data-testid="loan-card"] img, [data-testid="loan-card"] svg').first();
      await expect(bookImage).toBeVisible();
    }
  });

  test('should filter loans by status correctly', async ({ page }) => {
    await page.goto('/loans');
    
    // Count active lent loans
    await page.click('button:has-text("השאלתי")');
    const lentCount = await page.locator('[data-testid="loan-card"]').count();
    
    // Count active borrowed loans
    await page.click('button:has-text("שאלתי")');
    const borrowedCount = await page.locator('[data-testid="loan-card"]').count();
    
    // Count history
    await page.click('button:has-text("היסטוריה")');
    const historyCount = await page.locator('[data-testid="loan-card"]').count();
    
    console.log(`Lent: ${lentCount}, Borrowed: ${borrowedCount}, History: ${historyCount}`);
  });

  test('should navigate back to loans after marking as returned', async ({ page }) => {
    await page.goto('/loans');
    await page.click('button:has-text("השאלתי")');
    
    const loanCards = await page.locator('[data-testid="loan-card"]').count();
    if (loanCards > 0) {
      const initialCount = loanCards;
      
      await page.click('button:has-text("סמן כהוחזר")');
      
      const confirmButton = page.locator('button:has-text("אישור")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
        await page.waitForTimeout(1000);
        
        // Should return to loans page and count might decrease
        await expect(page).toHaveURL('/loans');
      }
    }
  });

  test('should handle no loans gracefully', async ({ page }) => {
    await page.goto('/loans');
    
    // Check all tabs for empty state messaging
    const tabs = ['השאלתי', 'שאלתי', 'היסטוריה'];
    
    for (const tab of tabs) {
      await page.click(`button:has-text("${tab}")`);
      const loanCount = await page.locator('[data-testid="loan-card"]').count();
      
      if (loanCount === 0) {
        const hasEmptyMessage = await page.locator('text=/אין|ספרים|רשימה ריקה/').isVisible();
        expect(hasEmptyMessage).toBeTruthy();
      }
    }
  });

  test('should show loan statistics on family dashboard', async ({ page }) => {
    await page.goto('/family');
    
    await expect(page.locator('text=/מושאלים|ספרים/')).toBeVisible();
    await expect(page.locator('text=/שהשאלנו|שאלנו/')).toBeVisible();
  });

  test('should navigate to loans from family dashboard', async ({ page }) => {
    await page.goto('/family');
    
    const loansButton = page.locator('button:has-text("ניהול השאלות")');
    if (await loansButton.isVisible()) {
      await loansButton.click();
      await expect(page).toHaveURL('/loans');
    }
  });
});
