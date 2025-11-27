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
          - generic:
            - text: אימייל
            - generic: "*"
          - generic [ref=e17]:
            - textbox "אימייל" [ref=e18]
            - group:
              - generic: אימייל *
        - button "המשך" [ref=e19] [cursor=pointer]
        - link "אין לך חשבון? הרשמה" [ref=e21]:
          - /url: /register
```