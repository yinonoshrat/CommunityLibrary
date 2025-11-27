# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6] [cursor=pointer]: ספריה קהילתית
      - generic [ref=e7]:
        - button "התחבר" [ref=e8] [cursor=pointer]
        - button "הירשם" [ref=e9] [cursor=pointer]
  - main [ref=e10]:
    - generic [ref=e13]:
      - heading "התחברות" [level=1] [ref=e14]
      - generic [ref=e15]:
        - generic [ref=e16]:
          - generic [ref=e17]:
            - text: אימייל
            - generic [ref=e18]: "*"
          - generic [ref=e19]:
            - textbox "אימייל" [active] [ref=e20]: test@example.com
            - group:
              - generic: אימייל *
        - button "המשך" [ref=e21] [cursor=pointer]
        - link "אין לך חשבון? הרשמה" [ref=e23]:
          - /url: /register
```