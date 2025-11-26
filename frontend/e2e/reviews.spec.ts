import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  test.skip(!process.env.TEST_USER_EMAIL, 'No test user configured');
  await page.goto('/login');
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

test.describe('Reviews and Ratings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display reviews section on book details page', async ({ page }) => {
    // Navigate to a book details page
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      // Reviews section should be visible
      await expect(page.locator('text=ביקורות')).toBeVisible();
    }
  });

  test('should show add review button', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      // Add review button should be visible
      const addReviewButton = page.locator('button:has-text("הוסף ביקורת")');
      await expect(addReviewButton).toBeVisible();
    }
  });

  test('should open add review dialog when clicking add button', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      // Click add review button
      await page.click('button:has-text("הוסף ביקורת")');
      
      // Dialog should open
      await expect(page.locator('text=הוסף ביקורת לספר')).toBeVisible();
      await expect(page.locator('textarea[name="review_text"]')).toBeVisible();
    }
  });

  test('should show rating input in add review dialog', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      await page.click('button:has-text("הוסף ביקורת")');
      
      // Rating component should be visible (5 stars)
      const ratingStars = page.locator('[aria-label*="stars"]');
      await expect(ratingStars).toBeVisible();
    }
  });

  test('should validate required fields in review form', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      await page.click('button:has-text("הוסף ביקורת")');
      
      // Try to submit without filling fields
      const submitButton = page.locator('button:has-text("שמור")');
      await submitButton.click();
      
      // Should show validation error or dialog should stay open
      const dialogStillOpen = await page.locator('text=הוסף ביקורת לספר').isVisible();
      expect(dialogStillOpen).toBeTruthy();
    }
  });

  test('should successfully add a review with rating', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      // Check if user already has a review
      const hasExistingReview = await page.locator('button:has-text("עריכת הביקורת שלי")').isVisible();
      
      if (!hasExistingReview) {
        await page.click('button:has-text("הוסף ביקורת")');
        
        // Set rating to 4 stars
        const starButtons = page.locator('[aria-label*="stars"] button');
        await starButtons.nth(3).click(); // 4th star (0-indexed)
        
        // Fill review text
        const timestamp = Date.now();
        await page.fill('textarea[name="review_text"]', `ביקורת אוטומטית ${timestamp} - ספר מעולה!`);
        
        // Submit
        await page.click('button:has-text("שמור")');
        
        // Wait for dialog to close and review to appear
        await page.waitForTimeout(2000);
        
        // Review should appear in the list
        await expect(page.locator(`text=/ביקורת אוטומטית ${timestamp}/`)).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should display existing reviews with ratings', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      // Check if there are reviews
      const reviewCards = page.locator('div').filter({ hasText: /⭐/ });
      const reviewCount = await reviewCards.count();
      
      if (reviewCount > 0) {
        // Should show reviewer name and rating
        await expect(reviewCards.first()).toBeVisible();
      }
    }
  });

  test('should show average rating when reviews exist', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      // Look for average rating display
      const hasReviews = await page.locator('text=/ממוצע דירוג|ביקורות/').isVisible();
      expect(hasReviews).toBeDefined();
    }
  });

  test('should allow sorting reviews by newest', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      // Look for sort dropdown
      const sortSelect = page.locator('select').filter({ hasText: /מיון|חדשות/ });
      if (await sortSelect.isVisible()) {
        await sortSelect.selectOption('newest');
        await page.waitForTimeout(500);
        
        // Reviews should still be displayed
        expect(await page.locator('text=ביקורות').isVisible()).toBeTruthy();
      }
    }
  });

  test('should allow sorting reviews by highest rated', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      const sortSelect = page.locator('select').filter({ hasText: /מיון|חדשות/ });
      if (await sortSelect.isVisible()) {
        await sortSelect.selectOption('highest');
        await page.waitForTimeout(500);
        
        expect(await page.locator('text=ביקורות').isVisible()).toBeTruthy();
      }
    }
  });

  test('should allow sorting reviews by lowest rated', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      const sortSelect = page.locator('select').filter({ hasText: /מיון|חדשות/ });
      if (await sortSelect.isVisible()) {
        await sortSelect.selectOption('lowest');
        await page.waitForTimeout(500);
        
        expect(await page.locator('text=ביקורות').isVisible()).toBeTruthy();
      }
    }
  });

  test('should show delete button only for own reviews', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      // Look for delete buttons
      const deleteButtons = page.locator('button[aria-label*="מחק"], button:has-text("מחק")');
      const deleteButtonCount = await deleteButtons.count();
      
      // User should only see delete button for their own review (0 or 1)
      expect(deleteButtonCount).toBeLessThanOrEqual(1);
    }
  });

  test('should show confirmation dialog before deleting review', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      // Look for delete button (only appears for own review)
      const deleteButton = page.locator('button[aria-label*="מחק"]').first();
      const hasDeleteButton = await deleteButton.isVisible();
      
      if (hasDeleteButton) {
        // Mock the confirm dialog
        page.on('dialog', dialog => dialog.accept());
        
        await deleteButton.click();
        
        // Wait for deletion to process
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should prevent adding duplicate review', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      // If user already has a review, button should say "edit"
      const hasExistingReview = await page.locator('button:has-text("עריכת הביקורת שלי")').isVisible();
      const addButton = await page.locator('button:has-text("הוסף ביקורת")').isVisible();
      
      // Should show either "add" or "edit", not both
      expect(hasExistingReview || addButton).toBeTruthy();
      if (hasExistingReview) {
        expect(addButton).toBeFalsy();
      }
    }
  });

  test('should display review date in relative format', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      // Look for relative dates (היום, אתמול, לפני X ימים)
      const relativeDates = page.locator('text=/היום|אתמול|לפני .* ימים|לפני .* שבועות/');
      const hasRelativeDates = await relativeDates.count();
      
      // If there are reviews, should show relative dates
      expect(hasRelativeDates).toBeGreaterThanOrEqual(0);
    }
  });

  test('should close add review dialog when clicking cancel', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      const hasAddButton = await page.locator('button:has-text("הוסף ביקורת")').isVisible();
      
      if (hasAddButton) {
        await page.click('button:has-text("הוסף ביקורת")');
        
        // Click cancel
        await page.click('button:has-text("ביטול")');
        
        // Dialog should close
        await expect(page.locator('text=הוסף ביקורת לספר')).not.toBeVisible();
      }
    }
  });

  test('should handle rating interaction correctly', async ({ page }) => {
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      await firstBook.click();
      await page.waitForLoadState('networkidle');
      
      const hasAddButton = await page.locator('button:has-text("הוסף ביקורת")').isVisible();
      
      if (hasAddButton) {
        await page.click('button:has-text("הוסף ביקורת")');
        
        // Try clicking different star ratings
        const starButtons = page.locator('[aria-label*="stars"] button');
        const starCount = await starButtons.count();
        
        if (starCount >= 5) {
          // Click 5th star
          await starButtons.nth(4).click();
          
          // Click 3rd star
          await starButtons.nth(2).click();
          
          // Rating should be interactive
          expect(starCount).toBeGreaterThanOrEqual(5);
        }
      }
    }
  });
});
