/**
 * Shared Vision Service Utilities
 * 
 * This module contains the shared prompt and logic for book detection
 * that is used by both the backend hybridVision service and the 
 * Supabase edge function detect-books.
 */

/**
 * Generate the Gemini prompt for book detection with OCR data
 * @param {string} structuredText - Formatted OCR text with positioning
 * @returns {string} - The complete prompt
 */
export function generateBookDetectionPrompt(structuredText) {
  return `You are an expert book librarian and image analyst. Your task is to analyze bookshelf images and extract ALL visible book information.

I have already extracted text visible in the image using OCR. The text is organized with positioning and orientation information:

--- STRUCTURED OCR DATA START ---
${structuredText}
--- STRUCTURED OCR DATA END ---

Your task:
1. Look at the image to see the physical books (spines, covers, arrangement)
2. Use the structured OCR data to help understand which text blocks belong together
3. Match text blocks to the books you see based on their position
4. Group text that appears close together (same book spine/cover)
5. For each book, identify the title and author from the grouped text and the image
6. if you can identify also series and number include them in the output
7. For each book return it genre from the following list in Hebrew:
  'רומן',  'מתח',  'מדע בדיוני',  'פנטזיה',  'ביוגרפיה',  'היסטוריה',  'מדע',  'ילדים',  'נוער',  'עיון',  'שירה',  'אחר'
8. For each book return it appropriate age range from the following list in Hebrew:
  '0-3',  '4-6',  '7-9',  '10-12',  '13-15',  '16-18',  'מבוגרים',  'כל הגילאים'

Understanding the data:
- Each text block has a position (centerX, centerY) and orientation (horizontal/vertical)
- Text blocks close together vertically or horizontally likely belong to the same book
- Book spines can be vertical (rotated text) or horizontal
- Titles are usually more prominent than author names

Return ONLY a valid JSON array with this exact structure:
[
  {
    "title": "exact book title from OCR",
    "author": "author name from OCR or empty string if not found",
    "series": "series name or empty string if not found",
    "series_number": number or null if not found,
    "genre": "genre in Hebrew from the predefined list",
    "age_range": "age range in Hebrew from the predefined list"
  }
]

Important guidelines:
- Only include books where you can clearly match text to a visible book
- Make sure that each book you outputed actually appears in the image
- Try to extract as many books as possible
- Use the exact text from the OCR results (preserve Hebrew/English/other languages)
- If author is not visible, use empty string ""
- Consider text proximity and orientation when grouping
- Book spines typically show title first, then author
- Return valid JSON array only, no markdown, no extra text
- If you can't identify any books with confidence, return an empty array []`;
}

/**
 * Generate a simple prompt for direct image analysis (without OCR)
 * @returns {string} - The complete prompt
 */
export function generateSimpleBookDetectionPrompt() {
  return `Analyze this image of a bookshelf and extract all visible book titles and authors.
Return the results as a JSON array with the following structure:
[
  {
    "title": "Book Title",
    "author": "Author Name",
    "series": "Series Name",
    "series_number": 1,
    "genre": "genre in Hebrew",
    "age_range": "age range in Hebrew"
  }
]

IMPORTANT RULES:
- Only include books where the title is clearly readable
- Include author name if visible on the spine or cover
- If author is not visible, use empty string ""
- If series information is visible, include it (series name and number)
- For genre, choose from: 'רומן', 'מתח', 'מדע בדיוני', 'פנטזיה', 'ביוגרפיה', 'היסטוריה', 'מדע', 'ילדים', 'נוער', 'עיון', 'שירה', 'אחר'
- For age_range, choose from: '0-3', '4-6', '7-9', '10-12', '13-15', '16-18', 'מבוגרים', 'כל הגילאים'
- Return valid JSON only, no additional text or markdown formatting
- Support both Hebrew and English titles
- If you see a series name and number (e.g., "Harry Potter 1"), include the number in the series_number field
- Do not include duplicate books
- If you cannot read any books clearly, return an empty array []`;
}

/**
 * Format structured OCR data for the Gemini prompt
 * @param {Object} ocrData - OCR data with fullText and blocks
 * @returns {string} - Formatted text for prompt
 */
export function formatStructuredOCR(ocrData) {
  const lines = [
    'Full text preview:',
    ocrData.fullText.substring(0, 300) + '...',
    '',
    'Structured text blocks:'
  ];
  
  // Group blocks by vertical proximity (likely same book spine)
  const groupedBlocks = groupTextBlocks(ocrData.blocks);
  
  groupedBlocks.forEach((group, groupIndex) => {
    lines.push(`\nGroup ${groupIndex + 1} (vertical position ~${Math.round(group[0].position.centerY)}):`);
    group.forEach(block => {
      const orientation = block.orientation === 'vertical' ? '↕' : '↔';
      const confidence = Math.round(block.confidence * 100);
      lines.push(`  ${orientation} "${block.text}" (x:${block.position.centerX}, y:${block.position.centerY}, conf:${confidence}%)`);
    });
  });
  
  return lines.join('\n');
}

/**
 * Group text blocks by proximity (likely same book)
 * @param {Array} blocks - Array of text blocks
 * @returns {Array} - Array of grouped blocks
 */
export function groupTextBlocks(blocks) {
  if (blocks.length === 0) return [];
  
  const groups = [];
  const verticalThreshold = 100; // pixels - adjust based on typical book spine height
  
  let currentGroup = [blocks[0]];
  
  for (let i = 1; i < blocks.length; i++) {
    const prevBlock = blocks[i - 1];
    const currentBlock = blocks[i];
    
    // If blocks are close vertically, add to same group
    if (Math.abs(currentBlock.position.centerY - prevBlock.position.centerY) < verticalThreshold) {
      currentGroup.push(currentBlock);
    } else {
      // Start new group
      groups.push(currentGroup);
      currentGroup = [currentBlock];
    }
  }
  
  // Add last group
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  return groups;
}

/**
 * Parse JSON response from Gemini (handles various formats)
 * @param {string} content - Response content
 * @returns {Array} - Array of books
 */
export function parseJsonResponse(content) {
  try {
    // Try direct JSON parse first
    const parsed = JSON.parse(content);
    
    if (Array.isArray(parsed)) {
      return validateBooks(parsed);
    }
    
    if (parsed.books && Array.isArray(parsed.books)) {
      return validateBooks(parsed.books);
    }
    
    throw new Error('Response is not an array');
    
  } catch (parseError) {
    console.log('Direct JSON parse failed, extracting JSON from text...');
    
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/) || 
                     content.match(/(\[[\s\S]*?\])/);
    
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed)) {
          return validateBooks(parsed);
        }
      } catch (e) {
        console.error('Failed to parse extracted JSON:', e);
      }
    }
    
    console.error('Failed to parse JSON response:', parseError);
    console.error('Raw content:', content);
    throw new Error('Could not parse JSON response from Gemini');
  }
}

/**
 * Validate and clean books array
 * @param {Array} books - Raw books array
 * @returns {Array} - Validated books array
 */
export function validateBooks(books) {
  return books
    .filter(book => {
      // Must be an object with a title
      if (!book || typeof book !== 'object' || !book.title) {
        return false;
      }
      
      // Title must be meaningful (at least 2 characters, not just punctuation)
      const title = String(book.title).trim();
      if (title.length < 2) {
        return false;
      }
      
      return true;
    })
    .map(book => ({
      title: String(book.title).trim(),
      author: book.author ? String(book.author).trim() : '',
      series: book.series ? String(book.series).trim() : (book.series_title ? String(book.series_title).trim() : null),
      series_number: normalizeSeriesNumber(
        book.series_number ?? book.seriesNumber ?? book.seriesIndex ?? null
      ),
      genre: book.genre ? String(book.genre).trim() : null,
      age_range: book.age_range ? String(book.age_range).trim() : null
    }));
}

/**
 * Normalize series number to a number or null
 * @param {*} value - The series number value
 * @returns {number|null} - Normalized series number
 */
export function normalizeSeriesNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  const match = String(value).match(/\d+/);
  if (match) {
    const num = Number(match[0]);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

/**
 * Detect MIME type from image buffer
 * @param {Buffer} buffer - Image buffer
 * @returns {string} - MIME type
 */
export function detectMimeType(buffer) {
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif';
  }
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return 'image/webp';
  }
  
  console.warn('Unknown image format, defaulting to image/jpeg');
  return 'image/jpeg';
}
