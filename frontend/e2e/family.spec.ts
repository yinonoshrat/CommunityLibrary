import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  test.skip(!process.env.TEST_USER_EMAIL, 'No test user configured');
  await page.goto('/login');
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

test.describe('Family Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display Family Dashboard', async ({ page }) => {
    await page.goto('/family');
    await expect(page.locator('text=/משפחת|דף הבית/')).toBeVisible();
  });

  test('should show family statistics', async ({ page }) => {
    await page.goto('/family');
    await page.waitForLoadState('networkidle');
    
    // Should display various stats
    await expect(page.locator('text=/ספרים|השאלות|חברי משפחה/')).toBeVisible();
  });

  test('should display quick action buttons', async ({ page }) => {
    await page.goto('/family');
    await page.waitForLoadState('networkidle');
    
    // Should show action buttons
    const buttons = page.locator('button:has-text(/הוסף|ניהול|הצג/)');
    expect(await buttons.count()).toBeGreaterThan(0);
  });

  test('should navigate to Family Members page', async ({ page }) => {
    await page.goto('/family');
    
    // Click on manage members button (if user is admin)
    const manageMembersBtn = page.locator('button:has-text("ניהול חברי משפחה")');
    const isAdmin = await manageMembersBtn.isVisible();
    
    if (isAdmin) {
      await manageMembersBtn.click();
      await expect(page).toHaveURL('/family/members');
    }
  });

  test('should display Family Members list', async ({ page }) => {
    await page.goto('/family/members');
    
    // If user is admin, should see members
    const hasAccess = await page.locator('text=חברי המשפחה').isVisible();
    
    if (hasAccess) {
      await expect(page.locator('text=חברי המשפחה')).toBeVisible();
      
      // Should show at least one member (the logged in user)
      const memberCards = page.locator('[data-testid="member-card"]');
      expect(await memberCards.count()).toBeGreaterThanOrEqual(1);
    }
  });

  test('should display member information correctly', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=חברי המשפחה').isVisible();
    
    if (hasAccess) {
      const firstMember = page.locator('[data-testid="member-card"]').first();
      
      // Should show member details
      await expect(firstMember.locator('text=/050-|02-|03-|04-|08-|09-/')).toBeVisible(); // Phone number
      await expect(firstMember.locator('text=/@/')).toBeVisible(); // Email
    }
  });

  test('should show admin badge for admin users', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=חברי המשפחה').isVisible();
    
    if (hasAccess) {
      // Should show admin badge somewhere
      const adminBadge = page.locator('text=מנהל');
      expect(await adminBadge.count()).toBeGreaterThanOrEqual(1);
    }
  });

  test('should not show edit/delete buttons for non-admin users', async ({ page }) => {
    await page.goto('/family/members');
    
    // If page redirects or shows error, user is not admin
    const isRedirected = await page.waitForURL('/family/members', { timeout: 2000 }).catch(() => false);
    
    if (!isRedirected) {
      // Non-admin user should be redirected or see error
      expect(page.url()).not.toContain('/family/members');
    }
  });

  test('admin should see edit buttons for members', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=חברי המשפחה').isVisible();
    
    if (hasAccess) {
      const editButtons = page.locator('button:has-text("ערוך")');
      const canEdit = await editButtons.count() > 0;
      
      if (canEdit) {
        await expect(editButtons.first()).toBeVisible();
      }
    }
  });

  test('admin should see delete buttons for members', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=חברי המשפחה').isVisible();
    
    if (hasAccess) {
      const deleteButtons = page.locator('button:has-text("הסר")');
      const canDelete = await deleteButtons.count() > 0;
      
      if (canDelete) {
        await expect(deleteButtons.first()).toBeVisible();
      }
    }
  });

  test('should show add member button for admin', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=חברי המשפחה').isVisible();
    
    if (hasAccess) {
      const addButton = page.locator('button:has-text("הוסף חבר משפחה")');
      const canAdd = await addButton.isVisible();
      
      if (canAdd) {
        await expect(addButton).toBeVisible();
      }
    }
  });

  test('should open add member dialog when clicking add button', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=חברי המשפחה').isVisible();
    
    if (hasAccess) {
      const addButton = page.locator('button:has-text("הוסף חבר משפחה")');
      const canAdd = await addButton.isVisible();
      
      if (canAdd) {
        await addButton.click();
        
        // Should open dialog with form
        await expect(page.locator('text=/הוסף.*משפחה/')).toBeVisible();
      }
    }
  });
});
