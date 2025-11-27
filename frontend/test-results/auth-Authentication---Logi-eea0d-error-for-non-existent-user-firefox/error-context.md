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
      - alert [ref=e15]:
        - img [ref=e17]
        - generic [ref=e19]: "JSON.parse: unexpected end of data at line 1 column 1 of the JSON data"
      - generic [ref=e20]:
        - generic [ref=e21]:
          - generic [ref=e22]:
            - text: אימייל
            - generic [ref=e23]: "*"
          - generic [ref=e24]:
            - textbox "אימייל" [ref=e25]: nonexistent@example.com
            - group:
              - generic: אימייל *
        - button "המשך" [ref=e26] [cursor=pointer]: המשך
        - link "אין לך חשבון? הרשמה" [ref=e28] [cursor=pointer]:
          - /url: /register
```