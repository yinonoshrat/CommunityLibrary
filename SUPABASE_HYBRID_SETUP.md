# Supabase Hybrid Vision Setup

To enable Hybrid Vision (OCR + AI) in your Supabase Edge Function, follow these steps:

## 1. Prerequisites

You need a Google Cloud Service Account with **Cloud Vision API** access.

1.  Go to Google Cloud Console.
2.  Enable **Cloud Vision API**.
3.  Create a Service Account.
4.  Download the JSON key file.

## 2. Configure Secrets

You need to set the `GOOGLE_CLOUD_CREDENTIALS` secret in your Supabase project.
The value must be the **minified** JSON string of your service account key.

```bash
# Get the JSON content (remove newlines)
# PowerShell
$json = Get-Content -Raw "path/to/service-account.json" | ConvertFrom-Json | ConvertTo-Json -Compress
npx supabase secrets set GOOGLE_CLOUD_CREDENTIALS=$json
```

## 3. Deploy Function

Deploy the updated function:

```bash
npx supabase functions deploy detect-books
```

## 4. Verification

When a detection job runs:
1.  The function checks for `GOOGLE_CLOUD_CREDENTIALS`.
2.  If found, it authenticates with Google Cloud using the service account.
3.  It calls Cloud Vision API to extract text (OCR).
4.  It passes the structured text to Gemini.
5.  If OCR fails (or credentials missing), it falls back to Gemini-only mode.

## Troubleshooting

Check the Edge Function logs in Supabase Dashboard:
- Look for "Google Cloud Credentials found, running Hybrid Vision..."
- Look for "OCR detected X text annotations"
- If you see "OCR failed", check the error message.
