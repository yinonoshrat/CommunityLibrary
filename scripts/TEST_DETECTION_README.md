# Book Detection Model Comparison Test

This script tests different Gemini models for book detection from images and generates a comprehensive comparison report.

## Usage

```bash
node scripts/test-detection-models.js <test-images-directory>
```

## Example

```bash
# Create a test images directory and add some book images
mkdir test-images
# Copy your book images to test-images/

# Run the comparison test
node scripts/test-detection-models.js ./test-images
```

## Models Tested

Currently configured models (edit `MODELS_TO_TEST` in the script to add more):
- `gemini-2.0-flash-exp` - Latest experimental flash model
- `gemini-1.5-flash` - Stable fast model
- `gemini-1.5-pro` - More capable but slower model

## Output

The script generates a detailed text report with:

### 1. Overall Statistics
- Total books detected per model
- Success/failure rates
- Average books per image
- Average processing duration

### 2. Detailed Results Per Image
- Full list of books detected by each model
- Processing time
- Any errors encountered

### 3. Model Comparison Analysis
- Books detected by both models
- Books unique to each model
- Differences in metadata (genre, age range)

### 4. Summary
- Best performing model (most books detected)
- Most reliable model (fewest failures)
- Fastest model (lowest average duration)

## Report File

The report is saved as: `detection-comparison-report-YYYY-MM-DDTHH-MM-SS.txt`

## Comparison Logic

- Book matching is case-insensitive
- Order of books doesn't matter
- Books are matched by: title + author + series + series_number
- Metadata differences (genre, age_range) are highlighted

## Adding New Models

Edit the `MODELS_TO_TEST` array in `test-detection-models.js`:

```javascript
const MODELS_TO_TEST = [
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'your-new-model-name'  // Add here
]
```

## Requirements

- Test images must be in supported formats: jpg, jpeg, png, gif, bmp, webp
- Environment variables must be configured (GEMINI_API_KEY, GOOGLE_CLOUD_CREDENTIALS)
- HybridVisionService must be available (Google Cloud Vision + Gemini)

## Tips

- Use a variety of images (different layouts, lighting, angles)
- Include images with different numbers of books (1, 5, 10+)
- Test with different book languages and styles
- Run tests multiple times to account for AI model variability
