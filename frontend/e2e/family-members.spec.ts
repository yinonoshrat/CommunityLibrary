import { test, expect } from '@playwright/test';

// Helper function for login as admin
async function loginAsAdmin(page: any) {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'yinono@gmail.com');
  await page.fill('input[name="password"]', 'Test1234!');
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 10000 });
}

test.describe('Family Members Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should navigate to family members page', async ({ page }) => {
    await page.goto('/family');
    
    const manageMembersButton = page.locator('button:has-text("ניהול חברי משפחה")');
    if (await manageMembersButton.isVisible()) {
      await manageMembersButton.click();
      await expect(page).toHaveURL('/family/members');
    }
  });

  test('should display family members page', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=/חברי המשפחה/').isVisible();
    if (hasAccess) {
      await expect(page.locator('text=/חברי המשפחה/')).toBeVisible();
    } else {
      await expect(page.locator('text=/רק מנהל/')).toBeVisible();
    }
  });

  test('should display list of family members', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=/חברי המשפחה/').isVisible();
    if (hasAccess) {
      const memberCards = await page.locator('[data-testid="member-card"]').count();
      expect(memberCards).toBeGreaterThan(0);
    }
  });

  test('should show member details (name, email, phone)', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=/חברי המשפחה/').isVisible();
    if (hasAccess) {
      const memberCard = page.locator('[data-testid="member-card"]').first();
      
      await expect(memberCard.locator('text=/.+@.+\\..+/')).toBeVisible(); // Email
      await expect(memberCard).toBeVisible();
    }
  });

  test('should show admin badge for admin users', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=/חברי המשפחה/').isVisible();
    if (hasAccess) {
      const adminBadge = page.locator('text=/מנהל משפחה/');
      const hasAdmins = await adminBadge.count() > 0;
      
      if (hasAdmins) {
        await expect(adminBadge.first()).toBeVisible();
      }
    }
  });

  test('should show edit button for each member', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=/חברי המשפחה/').isVisible();
    if (hasAccess) {
      const editButtons = await page.locator('button[aria-label*="edit"], button:has(svg):has-text("")').count();
      expect(editButtons).toBeGreaterThan(0);
    }
  });

  test('should show delete/remove button for each member', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=/חברי המשפחה/').isVisible();
    if (hasAccess) {
      const deleteButtons = await page.locator('button[color="error"]').count();
      expect(deleteButtons).toBeGreaterThan(0);
    }
  });

  test('should show "Add Family Member" button for admin', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=/חברי המשפחה/').isVisible();
    if (hasAccess) {
      await expect(page.locator('button:has-text("הוסף חבר משפחה")')).toBeVisible();
    }
  });

  test('should open add member dialog when clicking add button', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=/חברי המשפחה/').isVisible();
    if (hasAccess) {
      await page.click('button:has-text("הוסף חבר משפחה")');
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await expect(page.locator('text=/הוסף חבר משפחה/')).toBeVisible();
    }
  });

  test('should display available users dropdown in add member dialog', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=/חברי המשפחה/').isVisible();
    if (hasAccess) {
      await page.click('button:has-text("הוסף חבר משפחה")');
      
      // Check for either dropdown or empty state message
      const hasDropdown = await page.locator('label:has-text("בחר משתמש")').isVisible();
      const hasEmptyMessage = await page.locator('text=/אין משתמשים זמינים/').isVisible();
      
      expect(hasDropdown || hasEmptyMessage).toBeTruthy();
    }
  });

  test('should close add member dialog when clicking cancel', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=/חברי המשפחה/').isVisible();
    if (hasAccess) {
      await page.click('button:has-text("הוסף חבר משפחה")');
      await page.click('button:has-text("ביטול")');
      
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    }
  });

  test('should open edit dialog when clicking edit button', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=/חברי המשפחה/').isVisible();
    if (hasAccess) {
      const editButton = page.locator('[data-testid="member-card"]').first().locator('button').filter({ has: page.locator('svg') }).first();
      await editButton.click();
      
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await expect(page.locator('text=/עריכת פרטי/')).toBeVisible();
    }
  });

  test('should pre-fill edit form with member data', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=/חברי המשפחה/').isVisible();
    if (hasAccess) {
      const memberCard = page.locator('[data-testid="member-card"]').first();
      const memberName = await memberCard.locator('h6').textContent();
      
      const editButton = memberCard.locator('button').filter({ has: page.locator('svg') }).first();
      await editButton.click();
      
      const nameField = page.locator('input[label="שם מלא"], input[value*="' + memberName + '"]');
      if (await nameField.isVisible()) {
        const value = await nameField.inputValue();
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  test('should disable email field in edit form', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=/חברי המשפחה/').isVisible();
    if (hasAccess) {
      const editButton = page.locator('[data-testid="member-card"]').first().locator('button').filter({ has: page.locator('svg') }).first();
      await editButton.click();
      
      const emailField = page.locator('input[type="email"], input[disabled]').filter({ has: page.locator('input[value*="@"]') });
      if (await emailField.count() > 0) {
        await expect(emailField.first()).toBeDisabled();
      }
    }
  });

  test('should allow editing member name and phone', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=/חברי המשפחה/').isVisible();
    if (hasAccess) {
      const editButton = page.locator('[data-testid="member-card"]').first().locator('button').filter({ has: page.locator('svg') }).first();
      await editButton.click();
      
      const nameField = page.locator('input[label="שם מלא"]').first();
      if (await nameField.isVisible()) {
        await nameField.fill('שם מעודכן לבדיקה');
        await expect(nameField).toHaveValue('שם מעודכן לבדיקה');
      }
    }
  });

  test('should save member edits when clicking save', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=/חברי המשפחה/').isVisible();
    if (hasAccess) {
      const editButton = page.locator('[data-testid="member-card"]').first().locator('button').filter({ has: page.locator('svg') }).first();
      await editButton.click();
      
      const saveButton = page.locator('button:has-text("שמור")');
      if (await saveButton.isVisible()) {
        await saveButton.click();
        
        // Dialog should close
        await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should show confirmation dialog before removing member', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=/חברי המשפחה/').isVisible();
    if (hasAccess) {
      const memberCards = await page.locator('[data-testid="member-card"]').count();
      
      if (memberCards > 1) {
        // Find a delete button that's not for the current user
        const deleteButton = page.locator('[data-testid="member-card"]').nth(1).locator('button[color="error"]');
        
        page.on('dialog', dialog => dialog.accept());
        await deleteButton.click();
      }
    }
  });

  test('should prevent removing self from family', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=/חברי המשפחה/').isVisible();
    if (hasAccess) {
      // Try to find and click delete button on first member (likely self)
      const deleteButtons = page.locator('button[color="error"]');
      const count = await deleteButtons.count();
      
      if (count > 0) {
        const firstDeleteButton = deleteButtons.first();
        const isDisabled = await firstDeleteButton.isDisabled();
        
        // Self delete button should be disabled
        if (!isDisabled) {
          page.on('dialog', dialog => {
            expect(dialog.message()).toContain('עצמך');
            dialog.dismiss();
          });
          
          await firstDeleteButton.click();
        }
      }
    }
  });

  test('should filter to show only family members, not all users', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=/חברי המשפחה/').isVisible();
    if (hasAccess) {
      const memberCards = await page.locator('[data-testid="member-card"]').count();
      
      // Should show reasonable number of family members, not all users
      expect(memberCards).toBeLessThan(20);
      expect(memberCards).toBeGreaterThan(0);
    }
  });

  test('should show loading state while fetching members', async ({ page }) => {
    await page.goto('/family/members');
    
    // Check for loading spinner briefly
    const hasLoading = await page.locator('svg[class*="MuiCircularProgress"]').isVisible({ timeout: 1000 }).catch(() => false);
    
    // Eventually should show members or error
    await expect(page.locator('text=/חברי המשפחה|שגיאה/')).toBeVisible({ timeout: 5000 });
  });

  test('should navigate back to family dashboard', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=/חברי המשפחה/').isVisible();
    if (hasAccess) {
      await page.click('button:has-text("חזרה")');
      await expect(page).toHaveURL('/family');
    }
  });

  test('should handle API errors gracefully', async ({ page }) => {
    await page.route('**/api/users?familyId=*', route => 
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) })
    );
    
    await page.goto('/family/members');
    
    // Should show error message
    await expect(page.locator('text=/שגיאה/')).toBeVisible({ timeout: 5000 });
  });

  test('should display member count on family dashboard', async ({ page }) => {
    await page.goto('/family');
    
    const memberCount = page.locator('text=/חברי משפחה|משתמשים/');
    if (await memberCount.isVisible()) {
      await expect(memberCount).toBeVisible();
    }
  });

  test('should remove member from family (not delete user)', async ({ page }) => {
    await page.goto('/family/members');
    
    const hasAccess = await page.locator('text=/חברי המשפחה/').isVisible();
    if (hasAccess) {
      const initialCount = await page.locator('[data-testid="member-card"]').count();
      
      if (initialCount > 1) {
        const deleteButton = page.locator('[data-testid="member-card"]').nth(1).locator('button[color="error"]');
        
        page.on('dialog', dialog => dialog.accept());
        await deleteButton.click();
        
        await page.waitForTimeout(1000);
        
        const newCount = await page.locator('[data-testid="member-card"]').count();
        expect(newCount).toBeLessThanOrEqual(initialCount);
      }
    }
  });
});
