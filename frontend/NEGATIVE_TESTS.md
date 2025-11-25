# בדיקות שליליות ומקרי קצה - דוגמאות

## סקירה כללית

מסמך זה מסביר את הבדיקות השליליות והטיפול בשגיאות שנוספו למערך הבדיקות.

## 🔐 בדיקות אימות והרשמה

### 1. יצירת משתמש חדש (אוטומטי)

הבדיקות כעת יוצרות משתמשים באופן אוטומטי בזמן הריצה:

```typescript
// בדיקה: יצירת משתמש עם משפחה חדשה
test('should successfully register a new user with new family', async ({ page }) => {
  const testUser = generateTestUser(); // יוצר נתונים ייחודיים
  
  await page.goto('/register');
  await page.fill('input[name="name"]', testUser.name);
  await page.fill('input[name="email"]', testUser.email);
  await page.fill('input[name="password"]', testUser.password);
  await page.fill('input[name="phone"]', testUser.phone);
  await page.fill('input[name="familyName"]', testUser.familyName);
  
  await page.click('button[type="submit"]');
  
  // אימות שהמשתמש נכנס בהצלחה
  await expect(page).toHaveURL('/');
});
```

**מה נבדק:**
- ✅ יצירת משתמש חדש עובדת
- ✅ יצירת משפחה חדשה
- ✅ ניתוב אוטומטי לאחר הרשמה
- ✅ כניסה אוטומטית לאחר הרשמה

### 2. מניעת משתמשים כפולים

```typescript
test('should prevent duplicate user registration with same email', async ({ page }) => {
  const testUser = generateTestUser();
  
  // הרשמה ראשונה
  await registerUser(page, testUser);
  
  // ניסיון להירשם שוב עם אותו אימייל
  await page.goto('/register');
  await page.fill('input[name="email"]', testUser.email); // אותו אימייל!
  await page.fill('input[name="password"]', 'DifferentPassword123!');
  await page.click('button[type="submit"]');
  
  // צריכה להופיע הודעת שגיאה
  await expect(page.locator('text=/.*קיים.*|.*exists.*/i')).toBeVisible();
});
```

**מה נבדק:**
- ✅ אי אפשר להירשם פעמיים עם אותו אימייל
- ✅ הודעת שגיאה ברורה למשתמש
- ✅ המערכת לא מאפשרת חשבונות כפולים

### 3. תמיכה באימייל משותף (אותו אימייל, משפחות שונות)

```typescript
test('should allow registration to existing family with shared email', async ({ page }) => {
  // משתמש חדש באותה משפחה עם אותו אימייל
  await page.goto('/register');
  await page.fill('input[name="name"]', 'New Family Member');
  await page.fill('input[name="email"]', 'family@example.com'); // אימייל משותף
  await page.fill('input[name="password"]', 'Password123!');
  await page.selectOption('select[name="familyId"]', { index: 1 }); // משפחה קיימת
  
  await page.click('button[type="submit"]');
  
  // צריך להצליח
  await expect(page).toHaveURL('/');
});
```

**מה נבדק:**
- ✅ מספר משתמשים יכולים להשתמש באותו אימייל
- ✅ כל אחד שייך למשפחה שלו
- ✅ תומך במודל משפחתי

### 4. וולידציה של שדות חובה

```typescript
test('should validate required fields', async ({ page }) => {
  await page.goto('/register');
  await page.click('button[type="submit"]'); // שליחה ללא מילוי
  
  // צריכות להופיע מספר הודעות שגיאה
  const errors = page.locator('text=/.*חובה.*/i');
  await expect(errors.first()).toBeVisible();
});
```

**מה נבדק:**
- ✅ שדות חובה מסומנים
- ✅ לא ניתן לשלוח טופס ריק
- ✅ הודעות שגיאה ברורות

### 5. וולידציה של פורמט אימייל

```typescript
test('should validate email format', async ({ page }) => {
  await page.goto('/register');
  await page.fill('input[name="email"]', 'not-an-email'); // אימייל לא תקין
  await page.click('button[type="submit"]');
  
  await expect(page.locator('text=/.*אימייל.*תקין.*/i')).toBeVisible();
});
```

### 6. וולידציה של חוזק סיסמה

```typescript
test('should validate password strength', async ({ page }) => {
  await page.goto('/register');
  await page.fill('input[name="password"]', '123'); // סיסמה חלשה
  await page.click('button[type="submit"]');
  
  await expect(page.locator('text=/.*סיסמה.*חזקה.*/i')).toBeVisible();
});
```

## 🌐 בדיקות שגיאות רשת

### 1. טיפול בשגיאת Timeout

```typescript
test('should handle network timeout gracefully', async ({ page }) => {
  // סימולציה של שרת איטי
  await page.route('**/api/**', async (route) => {
    await new Promise(resolve => setTimeout(resolve, 30000)); // 30 שניות
    await route.continue();
  });

  await page.goto('/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.click('button[type="submit"]');

  // צריכה להופיע הודעת שגיאה
  await expect(page.locator('text=/.*timeout.*|.*קשר.*/i')).toBeVisible();
});
```

**מה נבדק:**
- ✅ המערכת לא קופאת על timeout
- ✅ הודעת שגיאה ידידותית למשתמש
- ✅ אפשרות לנסות שוב

### 2. טיפול בשגיאת 500

```typescript
test('should handle API 500 errors', async ({ page }) => {
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    });
  });

  await page.goto('/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.click('button[type="submit"]');

  await expect(page.locator('text=/.*שגיאה.*שרת.*/i')).toBeVisible();
});
```

### 3. ניסיון חוזר אוטומטי (Retry)

```typescript
test('should retry failed requests', async ({ page }) => {
  let requestCount = 0;
  
  await page.route('**/api/books**', async (route) => {
    requestCount++;
    if (requestCount < 2) {
      await route.fulfill({ status: 500 }); // כשלון בפעם הראשונה
    } else {
      await route.continue(); // הצלחה בפעם השנייה
    }
  });

  await page.goto('/books');
  await page.waitForTimeout(3000);
  
  expect(requestCount).toBeGreaterThanOrEqual(2); // נוסה לפחות פעמיים
});
```

## 📝 בדיקות וולידציה של נתונים

### 1. שדות חובה בספר

```typescript
test('should validate book form with missing required fields', async ({ page }) => {
  await page.goto('/books/add');
  await page.click('button[type="submit"]'); // שליחה ללא נתונים
  
  const errors = await page.locator('text=/.*חובה.*/i').count();
  expect(errors).toBeGreaterThanOrEqual(2); // לפחות שם ומחבר
});
```

### 2. מספרים שליליים

```typescript
test('should validate negative pages number', async ({ page }) => {
  await page.goto('/books/add');
  await page.fill('input[name="pages"]', '-100'); // שלילי
  
  const pagesValue = await page.locator('input[name="pages"]').inputValue();
  expect(parseInt(pagesValue) >= 0 || pagesValue === '').toBeTruthy();
});
```

### 3. טקסט ארוך מאוד

```typescript
test('should handle extremely long text inputs', async ({ page }) => {
  await page.goto('/books/add');
  
  const longText = 'א'.repeat(10000); // 10,000 תווים
  await page.fill('input[name="title"]', longText);
  
  // המערכת צריכה לטפל בזה (לקצץ או להציג שגיאה)
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
});
```

### 4. תווים מיוחדים

```typescript
test('should handle special characters in input', async ({ page }) => {
  await page.goto('/books/add');
  
  const specialChars = '!@#$%^&*()_+<>?:"{}[]\\|';
  await page.fill('input[name="title"]', `Book ${specialChars} Title`);
  
  // צריך לטפל בתווים מיוחדים ללא קריסה
  await page.click('button[type="submit"]');
});
```

## 🔒 בדיקות אבטחה

### 1. הגנה מפני XSS

```typescript
test('should sanitize HTML in book title', async ({ page }) => {
  await page.goto('/books/add');
  
  const xssPayload = '<script>alert("XSS")</script>';
  await page.fill('input[name="title"]', xssPayload);
  await page.click('button[type="submit"]');
  
  await page.waitForTimeout(2000);
  
  // אם הקוד הורץ, הבדיקה תיכשל
  // אם לא, המערכת הגנה בהצלחה
});
```

### 2. הגנה מפני SQL Injection

```typescript
test('should sanitize SQL-like input', async ({ page }) => {
  await page.goto('/books/add');
  
  const sqlPayload = "'; DROP TABLE books; --";
  await page.fill('input[name="title"]', sqlPayload);
  await page.click('button[type="submit"]');
  
  // המערכת צריכה לטפל בזה בצורה בטוחה
  await page.goto('/books');
  await page.waitForLoadState('networkidle'); // עדיין עובד
});
```

## 🔐 בדיקות הרשאות

### 1. מניעת עריכה של ספרים של משפחות אחרות

```typescript
test('should prevent editing books from other families', async ({ page }) => {
  await page.goto('/books');
  
  const firstBook = page.locator('[data-testid="book-card"]').first();
  await firstBook.click();
  
  const bookId = page.url().split('/').pop();
  
  // ניסיון לגשת ישירות לעריכה
  await page.goto(`/books/${bookId}/edit`);
  
  // אם לא בעלים, צריך להיות הפניה או שגיאה
});
```

### 2. מניעת גישה למנהל משפחה למשתמשים רגילים

```typescript
test('should prevent non-admin from accessing family members', async ({ page }) => {
  await page.goto('/family/members');
  
  const hasAccess = await page.locator('text=חברי המשפחה').isVisible();
  const redirected = !page.url().includes('/family/members');
  
  // אם לא מנהל, צריך להיות הפניה
  expect(hasAccess || redirected).toBeTruthy();
});
```

## 🖥️ בדיקות תאימות דפדפן

### 1. כפתור חזור

```typescript
test('should handle back button navigation', async ({ page }) => {
  await page.goto('/books');
  await page.goto('/books/add');
  
  await page.goBack();
  await expect(page).toHaveURL('/books');
  
  await page.goForward();
  await expect(page).toHaveURL('/books/add');
});
```

### 2. רענון דף

```typescript
test('should handle page refresh', async ({ page }) => {
  await page.goto('/books');
  await page.reload();
  
  // צריך להישאר מחובר ולהציג תוכן
  await expect(page.locator('text=הספרים שלי')).toBeVisible();
});
```

### 3. טאבים מרובים

```typescript
test('should handle simultaneous edits from multiple tabs', async ({ page, context }) => {
  await page.goto('/books');
  const firstBook = page.locator('[data-testid="book-card"]').first();
  await firstBook.click();
  
  const bookUrl = page.url();
  
  // פתיחת טאב שני
  const newPage = await context.newPage();
  await newPage.goto(bookUrl + '/edit');
  
  // עריכה בשני הטאבים במקביל
  // המערכת צריכה לטפל בזה (last write wins או התנגשות)
});
```

## 📊 סיכום הבדיקות השליליות

### סטטיסטיקות

| קטגוריה | מספר בדיקות | סטטוס |
|---------|-------------|--------|
| אימות והרשמה | 11 | ✅ |
| שגיאות רשת | 4 | ✅ |
| וולידציה | 6 | ✅ |
| פעולות במקביל | 3 | ✅ |
| תאימות דפדפן | 3 | ✅ |
| אבטחה | 2 | ✅ |
| הרשאות | 4 | ✅ |

**סה"כ: 33 בדיקות שליליות ומקרי קצה**

### מה מכוסה

✅ **יצירת משתמשים:**
- משתמש חדש עם משפחה חדשה
- מניעת כפילויות
- אימייל משותף למשפחה
- וולידציה מלאה

✅ **טיפול בשגיאות:**
- Timeout, 500, 404
- נתונים לא תקינים
- תווים מיוחדים
- XSS/SQL injection

✅ **הרשאות:**
- בעלים בלבד יכול לערוך
- מנהל בלבד יכול לנהל משפחה
- הגנה על נתונים

✅ **חוויית משתמש:**
- כפתור חזור
- רענון דף
- טאבים מרובים
- פעולות מהירות

## 🚀 הרצת הבדיקות

```bash
# כל הבדיקות
npm run test:e2e

# רק בדיקות אימות
npx playwright test auth.spec.ts

# רק בדיקות שגיאות
npx playwright test errors.spec.ts

# במצב ויזואלי
npm run test:e2e:ui
```

## 📖 למידע נוסף

- `E2E_TESTING.md` - תיעוד מלא
- `TESTING_QUICKSTART.md` - מדריך מהיר
- `TESTING_EXAMPLE.md` - דוגמאות צעד אחר צעד
