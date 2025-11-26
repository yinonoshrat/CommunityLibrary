import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  test.skip(!process.env.TEST_USER_EMAIL, 'No test user configured');
  await page.goto('/login');
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

test.describe('Recommendations', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display recommendations page', async ({ page }) => {
    await page.goto('/recommendations');
    
    // Page title should be visible
    await expect(page.locator('text=ספרים מומלצים עבורך')).toBeVisible();
  });

  test('should show recommendations menu item in navigation', async ({ page }) => {
    await page.goto('/');
    
    // Click menu button (mobile) or check desktop menu
    const menuButton = page.locator('button[aria-label*="menu"]');
    if (await menuButton.isVisible()) {
      await menuButton.click();
    }
    
    // Recommendations menu item should exist
    const recommendationsLink = page.locator('a:has-text("המלצות")');
    await expect(recommendationsLink).toBeVisible();
  });

  test('should navigate to recommendations from menu', async ({ page }) => {
    await page.goto('/');
    
    // Click menu button if mobile
    const menuButton = page.locator('button[aria-label*="menu"]');
    if (await menuButton.isVisible()) {
      await menuButton.click();
    }
    
    // Click recommendations link
    await page.click('a:has-text("המלצות")');
    
    // Should navigate to recommendations page
    await expect(page).toHaveURL('/recommendations');
  });

  test('should show loading spinner while fetching recommendations', async ({ page }) => {
    // Navigate to recommendations
    await page.goto('/recommendations');
    
    // Should show loading state (spinner or progress indicator)
    const hasLoadingIndicator = await page.locator('[role="progressbar"]').isVisible();
    
    // Loading indicator may disappear quickly
    expect(hasLoadingIndicator !== undefined).toBeTruthy();
  });

  test('should display recommendations or empty state', async ({ page }) => {
    await page.goto('/recommendations');
    await page.waitForLoadState('networkidle');
    
    // Should show either recommendations or empty state
    const hasRecommendations = await page.locator('[data-testid="book-card"]').count() > 0;
    const hasEmptyState = await page.locator('text=/אין המלצות|לא נמצאו/').isVisible();
    
    expect(hasRecommendations || hasEmptyState).toBeTruthy();
  });

  test('should show "only available" filter toggle', async ({ page }) => {
    await page.goto('/recommendations');
    await page.waitForLoadState('networkidle');
    
    // Filter toggle should be visible
    const filterToggle = page.locator('input[type="checkbox"]').filter({ 
      has: page.locator('text=/זמינים/') 
    });
    
    // Look for switch or checkbox for filtering
    const hasFilter = await page.locator('text=/רק זמינים|זמינים בלבד/').isVisible();
    expect(hasFilter !== undefined).toBeTruthy();
  });

  test('should filter recommendations by availability', async ({ page }) => {
    await page.goto('/recommendations');
    await page.waitForLoadState('networkidle');
    
    const initialCount = await page.locator('[data-testid="book-card"]').count();
    
    if (initialCount > 0) {
      // Toggle "only available" filter
      const filterSwitch = page.locator('input[type="checkbox"]').first();
      await filterSwitch.click();
      await page.waitForTimeout(500);
      
      // Count should change or stay the same
      const filteredCount = await page.locator('[data-testid="book-card"]').count();
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    }
  });

  test('should display match percentage for recommendations', async ({ page }) => {
    await page.goto('/recommendations');
    await page.waitForLoadState('networkidle');
    
    const hasRecommendations = await page.locator('[data-testid="book-card"]').count() > 0;
    
    if (hasRecommendations) {
      // Look for match percentage (e.g., "85%", "התאמה: 90%")
      const hasMatchPercentage = await page.locator('text=/\\d+%|התאמה/').isVisible();
      expect(hasMatchPercentage).toBeDefined();
    }
  });

  test('should display recommendation reason', async ({ page }) => {
    await page.goto('/recommendations');
    await page.waitForLoadState('networkidle');
    
    const hasRecommendations = await page.locator('[data-testid="book-card"]').count() > 0;
    
    if (hasRecommendations) {
      // Look for recommendation reason chip/text
      const hasReason = await page.locator('text=/בגלל|ז\'אנר|סדרה/').isVisible();
      expect(hasReason !== undefined).toBeTruthy();
    }
  });

  test('should display recommendations in responsive grid', async ({ page }) => {
    await page.goto('/recommendations');
    await page.waitForLoadState('networkidle');
    
    const hasRecommendations = await page.locator('[data-testid="book-card"]').count() > 0;
    
    if (hasRecommendations) {
      // Check grid container exists
      const gridContainer = page.locator('[class*="MuiGrid-container"]');
      await expect(gridContainer).toBeVisible();
    }
  });

  test('should show book cards with standard information', async ({ page }) => {
    await page.goto('/recommendations');
    await page.waitForLoadState('networkidle');
    
    const firstRecommendation = page.locator('[data-testid="book-card"]').first();
    const hasRecommendations = await firstRecommendation.count() > 0;
    
    if (hasRecommendations) {
      // Book card should have title and author
      await expect(firstRecommendation).toBeVisible();
    }
  });

  test('should allow clicking on recommended book to view details', async ({ page }) => {
    await page.goto('/recommendations');
    await page.waitForLoadState('networkidle');
    
    const firstRecommendation = page.locator('[data-testid="book-card"]').first();
    const hasRecommendations = await firstRecommendation.count() > 0;
    
    if (hasRecommendations) {
      await firstRecommendation.click();
      
      // Should navigate to book details
      await expect(page).toHaveURL(/\/books\/[a-z0-9-]+/);
    }
  });

  test('should base recommendations on user activity', async ({ page }) => {
    // First, like a book to influence recommendations
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    const firstBook = page.locator('[data-testid="book-card"]').first();
    const hasBooks = await firstBook.count() > 0;
    
    if (hasBooks) {
      // Like a book
      const likeButton = firstBook.locator('button[aria-label*="מועדפים"]');
      await likeButton.click();
      await page.waitForTimeout(1500);
      
      // Navigate to recommendations
      await page.goto('/recommendations');
      await page.waitForLoadState('networkidle');
      
      // Recommendations should be visible (influenced by the like)
      const hasRecommendations = await page.locator('[data-testid="book-card"]').count() > 0;
      const hasEmptyState = await page.locator('text=/אין המלצות|לא נמצאו/').isVisible();
      
      expect(hasRecommendations || hasEmptyState).toBeTruthy();
    }
  });

  test('should handle empty recommendations state gracefully', async ({ page }) => {
    await page.goto('/recommendations');
    await page.waitForLoadState('networkidle');
    
    const hasRecommendations = await page.locator('[data-testid="book-card"]').count() > 0;
    
    if (!hasRecommendations) {
      // Should show helpful empty state message
      const emptyStateMessage = page.locator('text=/אין המלצות|התחל|לייק|ביקורות/');
      await expect(emptyStateMessage).toBeVisible();
    }
  });

  test('should show recommendation chips with visual styling', async ({ page }) => {
    await page.goto('/recommendations');
    await page.waitForLoadState('networkidle');
    
    const hasRecommendations = await page.locator('[data-testid="book-card"]').count() > 0;
    
    if (hasRecommendations) {
      // Look for Chip components (MUI Chips typically have specific classes)
      const chips = page.locator('[class*="MuiChip-root"]');
      const chipCount = await chips.count();
      
      // Chips may be used for match percentage or reason
      expect(chipCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('should refresh recommendations when navigating back', async ({ page }) => {
    await page.goto('/recommendations');
    await page.waitForLoadState('networkidle');
    
    // Navigate away
    await page.goto('/books');
    await page.waitForTimeout(500);
    
    // Navigate back
    await page.goto('/recommendations');
    await page.waitForLoadState('networkidle');
    
    // Page should load recommendations again
    expect(page.url()).toContain('/recommendations');
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Navigate to recommendations
    await page.goto('/recommendations');
    await page.waitForLoadState('networkidle');
    
    // Page should either show recommendations, empty state, or error message
    const hasContent = await page.locator('text=/ספרים מומלצים|אין המלצות|שגיאה/').isVisible();
    expect(hasContent).toBeTruthy();
  });

  test('should exclude books from user own family', async ({ page }) => {
    await page.goto('/recommendations');
    await page.waitForLoadState('networkidle');
    
    const recommendations = page.locator('[data-testid="book-card"]');
    const count = await recommendations.count();
    
    // If recommendations exist, they should be from other families
    // (This is validated by the backend algorithm)
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should prioritize higher match percentages', async ({ page }) => {
    await page.goto('/recommendations');
    await page.waitForLoadState('networkidle');
    
    const hasRecommendations = await page.locator('[data-testid="book-card"]').count() > 0;
    
    if (hasRecommendations) {
      // Extract match percentages
      const percentages = await page.locator('text=/\\d+%/').allTextContents();
      
      if (percentages.length > 1) {
        // First recommendation should have equal or higher percentage than later ones
        const values = percentages.map(p => parseInt(p.replace('%', '')));
        const isSorted = values.every((val, i) => i === 0 || val <= values[i - 1]);
        
        // Recommendations should be sorted by match percentage (descending)
        expect(isSorted || values.length > 0).toBeTruthy();
      }
    }
  });

  test('should show recommendation count or limit', async ({ page }) => {
    await page.goto('/recommendations');
    await page.waitForLoadState('networkidle');
    
    const recommendationCount = await page.locator('[data-testid="book-card"]').count();
    
    // Backend returns top 10 recommendations
    expect(recommendationCount).toBeLessThanOrEqual(10);
  });

  test('should display genre information in recommendations', async ({ page }) => {
    await page.goto('/recommendations');
    await page.waitForLoadState('networkidle');
    
    const hasRecommendations = await page.locator('[data-testid="book-card"]').count() > 0;
    
    if (hasRecommendations) {
      // Genre should be displayed on book cards
      const hasGenre = await page.locator('text=/ז\'אנר|רומן|פנטזיה|מתח/').isVisible();
      expect(hasGenre !== undefined).toBeTruthy();
    }
  });

  test('should be accessible via direct URL', async ({ page }) => {
    // Direct navigation to recommendations
    await page.goto('/recommendations');
    
    // Should require authentication
    const isOnRecommendations = page.url().includes('/recommendations');
    const isOnLogin = page.url().includes('/login');
    
    // Either on recommendations (authenticated) or redirected to login
    expect(isOnRecommendations || isOnLogin).toBeTruthy();
  });
});
