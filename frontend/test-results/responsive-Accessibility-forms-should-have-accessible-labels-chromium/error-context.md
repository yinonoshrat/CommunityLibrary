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
        - generic:
          - text: אימייל
          - generic: "*"
        - generic [ref=e15]:
          - textbox "אימייל" [ref=e16]
          - group:
            - generic: אימייל *
      - button "המשך" [ref=e17] [cursor=pointer]
      - link "אין לך חשבון? הרשמה" [ref=e19] [cursor=pointer]:
        - /url: /register
```