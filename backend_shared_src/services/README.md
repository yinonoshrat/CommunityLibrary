# AI Vision Services

This directory contains AI vision services for detecting book titles and authors from bookshelf images.

## Available Services

### 1. Hybrid Vision (Google Cloud OCR + Gemini) ⭐ **RECOMMENDED**
**File:** `hybridVision.js`

**How it works:**
1. **Step 1:** Uses Google Cloud Vision OCR to extract all text from the image
2. **Step 2:** Sends OCR results + image to Gemini to intelligently match text to book spines

**Features:**
- **Highest accuracy** - Combines OCR precision with AI reasoning
- Excellent for complex layouts and mixed languages
- Better handling of Hebrew text
- More reliable text extraction than vision-only models

**Setup:**
1. Create a Google Cloud project and enable Vision API
2. Create a service account and download credentials JSON
3. Get a Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
4. Add to environment variables:
   ```bash
   # Option 1: JSON credentials as string
   GOOGLE_CLOUD_CREDENTIALS='{"type":"service_account","project_id":"...",...}'
   
   # Option 2: Path to credentials file
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
   
   # Gemini API key (required)
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

**Cost:** ~$1.50 per 1000 images (OCR) + free Gemini calls

---

### 2. OpenAI GPT-4o-mini
**File:** `openaiVision.js`

**Features:**
- Uses OpenAI's GPT-4o-mini vision model
- Fast and cost-effective
- Good accuracy for both English and Hebrew text
- Single-step processing

**Setup:**
1. Get an API key from [OpenAI Platform](https://platform.openai.com/)
2. Add to environment variables:
   ```bash
   OPENAI_API_KEY=your_openai_api_key_here
   ```

**Cost:** ~$0.003 per image

---

### 3. Google Gemini 2.5 Flash
**File:** `geminiVision.js`

**Features:**
- Uses Google's Gemini 2.5 Flash model
- Free tier available
- Good accuracy for multi-language text
- Vision-only approach

**Setup:**
1. Get an API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add to environment variables:
   ```bash
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

**Cost:** Free tier: 1,500 requests/day

## Priority Order

The system automatically selects the available service in this order:
1. **Hybrid** (if both `GOOGLE_APPLICATION_CREDENTIALS`/`GOOGLE_CLOUD_CREDENTIALS` and `GEMINI_API_KEY` are set)
2. **OpenAI GPT-4o-mini** (if `OPENAI_API_KEY` is set)
3. **Gemini 2.5 Flash** (if `GEMINI_API_KEY` is set)
4. Disabled (if no API keys are available)

## Comparison

| Service | Accuracy | Speed | Cost/1000 images | Best For |
|---------|----------|-------|------------------|----------|
| **Hybrid** | ⭐⭐⭐⭐⭐ | Medium | ~$1.50 | Production, Hebrew text |
| **OpenAI** | ⭐⭐⭐⭐ | Fast | ~$3.00 | Quick setup, English text |
| **Gemini** | ⭐⭐⭐ | Fast | Free/Paid | Development, testing |

## Usage

The services are used automatically by the bulk upload feature. When a user uploads a bookshelf image:

1. The image is sent to the active vision service
2. **Hybrid:** OCR extracts text → Gemini matches text to books
   **Others:** AI directly analyzes the image
3. Each detected book is enriched with metadata from Google Books API
4. Results are sorted by confidence score

## Google Cloud Setup (for Hybrid Service)

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the **Cloud Vision API**

### Step 2: Create Service Account
1. Go to **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. Name: `book-vision-service`
4. Role: **Cloud Vision API User**
5. Click **Create Key** → **JSON**
6. Download the JSON file

### Step 3: Set Environment Variable
```bash
# For local development (.env.development.local)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json

# Or inline JSON (for Vercel)
GOOGLE_CLOUD_CREDENTIALS='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'

# Don't forget Gemini API key
GEMINI_API_KEY=your_gemini_api_key_here
```

### For Vercel Deployment
1. Copy entire JSON credentials file content
2. In Vercel dashboard → Project Settings → Environment Variables
3. Add `GOOGLE_CLOUD_CREDENTIALS` with the JSON as value (as a string)
4. Add `GEMINI_API_KEY` with your Gemini key

## Adding a New Vision Service

To add support for another AI provider (Azure, Claude, etc.):

1. Create a new file (e.g., `azureVision.js`)
2. Extend the `AIVisionService` base class
3. Implement `detectBooksFromImage(imageBuffer)` method
4. Update `api/index.js` to include your service in the initialization logic

Example:
```javascript
import AIVisionService from './aiVisionService.js';

class AzureVisionService extends AIVisionService {
  async detectBooksFromImage(imageBuffer) {
    // Your implementation here
    return [
      { title: "Book Title", author: "Author Name" }
    ];
  }
}
```

## Testing

To test the vision service locally:

```bash
# Set your API key
export OPENAI_API_KEY=your_key_here
# or
export GEMINI_API_KEY=your_key_here

# Start the backend
npm run dev:backend

# Upload an image via the frontend bulk upload feature
```

## Cost Considerations

### Hybrid (Google Cloud OCR + Gemini)
- **OCR:** $1.50 per 1,000 images (first 1,000/month free)
- **Gemini:** Free tier (1,500 requests/day) or paid
- **Total:** ~$1.50 per 1,000 images (with free Gemini tier)
- **Recommended for:** Production with high accuracy needs

### OpenAI GPT-4o-mini
- **Input:** $0.15 per 1M tokens (~$0.003 per image)
- **Output:** $0.60 per 1M tokens
- **Total:** ~$3 per 1,000 images
- **Recommended for:** Quick setup, English-heavy catalogs

### Google Gemini 2.5 Flash
- **Free tier:** 1,500 requests per day
- **Paid:** Check Google AI pricing
- **Recommended for:** Development and testing

## Troubleshooting

**Hybrid Service:**
- **"Google Cloud credentials required"** → Set `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_CLOUD_CREDENTIALS`
- **"Vision API has not been enabled"** → Enable Cloud Vision API in Google Cloud Console
- **"PERMISSION_DENIED"** → Check service account has "Cloud Vision API User" role
- **"Invalid JSON credentials"** → Verify JSON format is correct

**OpenAI Service:**
- **"Insufficient quota"** → Check OpenAI billing and usage limits
- **"Invalid API key"** → Verify `OPENAI_API_KEY` is correct

**Gemini Service:**
- **"API key not valid"** → Get new key from Google AI Studio
- **"Resource exhausted"** → Check daily quota (1,500 free requests/day)

**General:**
- **No books detected:** Ensure image is clear, well-lit, with readable text
- **Low accuracy:** Try Hybrid service for better OCR + AI reasoning
- **Mixed results:** Check console logs for detailed error messages
