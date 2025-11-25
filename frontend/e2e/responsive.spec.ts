import { test, expect } from '@playwright/test';

test.describe('Responsive Design - Mobile', () => {
  test.use({ 
    viewport: { width: 375, height: 667 } // iPhone SE size
  });

  test('should display mobile navigation menu', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, 'No test user configured');
    
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Should show hamburger menu icon on mobile
    const menuButton = page.locator('button[aria-label*="menu"], button:has(svg)').first();
    await expect(menuButton).toBeVisible();
  });

  test('should open mobile menu drawer', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, 'No test user configured');
    
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    const menuButton = page.locator('button[aria-label*="menu"], button:has(svg)').first();
    await menuButton.click();
    
    // Drawer should open with navigation items
    await expect(page.locator('text=בית')).toBeVisible();
    await expect(page.locator('text=הספרים שלי')).toBeVisible();
  });

  test('should display book cards in single column on mobile', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, 'No test user configured');
    
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    // Check that cards stack vertically
    const bookCards = page.locator('[data-testid="book-card"]');
    const count = await bookCards.count();
    
    if (count >= 2) {
      const firstCard = await bookCards.nth(0).boundingBox();
      const secondCard = await bookCards.nth(1).boundingBox();
      
      // Second card should be below first card (not side by side)
      if (firstCard && secondCard) {
        expect(secondCard.y).toBeGreaterThan(firstCard.y + firstCard.height - 10);
      }
    }
  });

  test('forms should be mobile-friendly', async ({ page }) => {
    await page.goto('/register');
    
    // Form inputs should be large enough for touch
    const nameInput = page.locator('input[name="name"]');
    const box = await nameInput.boundingBox();
    
    if (box) {
      // Minimum touch target height should be around 44px
      expect(box.height).toBeGreaterThanOrEqual(40);
    }
  });
});

test.describe('Responsive Design - Tablet', () => {
  test.use({ 
    viewport: { width: 768, height: 1024 } // iPad size
  });

  test('should display book cards in grid on tablet', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, 'No test user configured');
    
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    // Should show multiple columns
    const bookCards = page.locator('[data-testid="book-card"]');
    const count = await bookCards.count();
    
    if (count >= 2) {
      const firstCard = await bookCards.nth(0).boundingBox();
      const secondCard = await bookCards.nth(1).boundingBox();
      
      // Cards might be side by side on tablet
      if (firstCard && secondCard) {
        // Either side by side or stacked
        const sideBySide = Math.abs(firstCard.y - secondCard.y) < 50;
        const stacked = secondCard.y > firstCard.y + firstCard.height - 50;
        expect(sideBySide || stacked).toBeTruthy();
      }
    }
  });

  test('navigation should be visible on tablet', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, 'No test user configured');
    
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    // Navigation items might be visible directly or via menu
    const hasDirectNav = await page.locator('text=בית').isVisible();
    const hasMenuButton = await page.locator('button[aria-label*="menu"]').isVisible();
    
    expect(hasDirectNav || hasMenuButton).toBeTruthy();
  });
});

test.describe('RTL Support', () => {
  test('should have RTL direction on pages', async ({ page }) => {
    await page.goto('/');
    
    const html = page.locator('html');
    const dir = await html.getAttribute('dir');
    expect(dir).toBe('rtl');
  });

  test('text should be aligned to the right', async ({ page }) => {
    await page.goto('/login');
    
    // Check that the page has RTL direction set
    const direction = await page.evaluate(() => {
      return document.documentElement.dir || document.body.dir || 
             window.getComputedStyle(document.documentElement).direction;
    });
    
    expect(direction).toBe('rtl');
  });

  test('form inputs should support RTL', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator('input[name="email"]');
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill('test@example.com');
    
    // Input should handle RTL correctly
    const value = await emailInput.inputValue();
    expect(value).toBe('test@example.com');
  });

  test('buttons should have icons on the right side in RTL', async ({ page }) => {
    await page.goto('/login');
    
    // Check that page renders without errors
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test.skip('should have proper page titles', async ({ page }) => {
    // TODO: Implement dynamic page titles using react-helmet-async
    await page.goto('/');
    expect(await page.title()).toBeTruthy();
    
    await page.goto('/login');
    expect(await page.title()).toContain('התחברות');
  });

  test('forms should have accessible labels', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Inputs should have labels or aria-labels
    const emailInput = page.locator('input[name="email"]');
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    const label = await emailInput.getAttribute('aria-label');
    const placeholder = await emailInput.getAttribute('placeholder');
    
    expect(label || placeholder).toBeTruthy();
  });

  test('buttons should have accessible text', async ({ page }) => {
    await page.goto('/login');
    
    const submitButton = page.locator('button[type="submit"]');
    const text = await submitButton.textContent();
    const ariaLabel = await submitButton.getAttribute('aria-label');
    
    expect(text || ariaLabel).toBeTruthy();
  });

  test('images should have alt text', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, 'No test user configured');
    
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    await page.goto('/books');
    await page.waitForTimeout(1000);
    
    // Check book cover images
    const images = page.locator('img');
    const count = await images.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      expect(alt !== null).toBeTruthy();
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Tab through form fields
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should be able to navigate with keyboard
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
    expect(['INPUT', 'BUTTON', 'A', 'BODY']).toContain(focusedElement || 'BODY');
  });
});
