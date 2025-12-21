# Page snapshot

```yaml
- generic [ref=e2]:
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
          - button "התחבר עם Google" [ref=e16] [cursor=pointer]:
            - img [ref=e18]
            - text: התחבר עם Google
          - generic [ref=e20]:
            - separator [ref=e21]
            - paragraph [ref=e22]: או
            - separator [ref=e23]
        - generic [ref=e24]:
          - generic [ref=e25]:
            - generic [ref=e26]:
              - text: אימייל
              - generic [ref=e27]: "*"
            - generic [ref=e28]:
              - textbox "אימייל" [active] [ref=e29]: yinono@gmail.com
              - group:
                - generic: אימייל *
          - button "המשך" [ref=e30] [cursor=pointer]
          - link "אין לך חשבון? הרשמה" [ref=e32] [cursor=pointer]:
            - /url: /register
  - generic [ref=e33]:
    - img [ref=e35]
    - button "Open Tanstack query devtools" [ref=e83] [cursor=pointer]:
      - img [ref=e84]
```