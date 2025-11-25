# Page snapshot

```yaml
- generic [ref=e2]:
  - banner [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5] [cursor=pointer]: ספריה קהילתית
      - generic [ref=e6]:
        - button "התחבר" [ref=e7] [cursor=pointer]
        - button "הירשם" [ref=e8] [cursor=pointer]
  - generic [ref=e11]:
    - heading "התחברות" [level=1] [ref=e12]
    - generic [ref=e13]:
      - generic [ref=e14]:
        - generic [ref=e15]:
          - text: אימייל
          - generic [ref=e16]: "*"
        - generic [ref=e17]:
          - textbox "אימייל" [active] [ref=e18]: test@example.com
          - group:
            - generic: אימייל *
      - button "המשך" [ref=e19] [cursor=pointer]
      - link "אין לך חשבון? הרשמה" [ref=e21] [cursor=pointer]:
        - /url: /register
```