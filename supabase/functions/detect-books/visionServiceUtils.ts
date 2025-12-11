/**
 * Shared Vision Service Utilities (TypeScript version for Deno)
 * 
 * This module contains the shared prompt and logic for book detection
 * that is used by both the backend hybridVision service and the 
 * Supabase edge function detect-books.
 */

/**
 * Generate the Gemini prompt for book detection with optional OCR data
 */
export function generateBookDetectionPrompt(structuredText?: string): string {
  const ocrSection = structuredText ? `
I have already extracted text visible in the image using OCR. The text is organized with positioning and orientation information:

--- STRUCTURED OCR DATA START ---
${structuredText}
--- STRUCTURED OCR DATA END ---

` : '';

  const ocrGuidelines = structuredText ? `
- Use the structured OCR data to help understand which text blocks belong together
- Match text blocks to the books you see based on their position
- Consider text proximity and orientation when grouping
- Each text block has a position (centerX, centerY) and orientation (horizontal/vertical)
- Text blocks close together vertically or horizontally likely belong to the same book
- Identify text on book spines and covers
- Group text that appears together on the same book
- Preserve Hebrew/English/other languages exactly as they appear` : '';

  return `You are an expert book librarian and image analyst. Your task is to analyze bookshelf images and extract ALL visible book information.
${ocrSection}
Your task:
1. Look at the image to see the physical books (spines, covers, arrangement)
${ocrGuidelines}
2. For each book, identify the title and author
3. If you can identify series name and number, include them in the output
4. For each book return its genre from the following list in Hebrew:
  'רומן',  'מתח',  'מדע בדיוני',  'פנטזיה',  'ביוגרפיה',  'היסטוריה',  'מדע',  'ילדים',  'נוער',  'עיון',  'שירה',  'אחר'
5. For each book return its appropriate age range from the following list in Hebrew:
  '0-3',  '4-6',  '7-9',  '10-12',  '13-15',  '16-18',  'מבוגרים',  'כל הגילאים'

Return ONLY a valid JSON array with this exact structure:
[
  {
    "title": "exact book title",
    "author": "author name or empty string if not found",
    "series": "series name or empty string if not found",
    "series_number": number or null if not found,
    "genre": "genre in Hebrew from the predefined list",
    "age_range": "age range in Hebrew from the predefined list"
  }
]

Important guidelines:
- Only include books where you can clearly match text to a visible book
- Make sure that each book you output actually appears in the image
- Try to extract as many books as possible
- If author is not visible, use empty string ""
- Book spines typically show title first, then author
- Return valid JSON array only, no markdown, no extra text
- If you can't identify any books with confidence, return an empty array []`;
}

interface TextBlock {
  text: string;
  confidence: number;
  position: {
    centerX: number;
    centerY: number;
  };
  orientation: 'vertical' | 'horizontal';
}

interface OCRData {
  fullText: string;
  blocks: TextBlock[];
}

/**
 * Format structured OCR data for the Gemini prompt
 */
export function formatStructuredOCR(ocrData: OCRData): string {
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
 */
export function groupTextBlocks(blocks: TextBlock[]): TextBlock[][] {
  if (blocks.length === 0) return [];
  
  const groups: TextBlock[][] = [];
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

interface RawBook {
  title?: string;
  author?: string;
  series?: string;
  series_title?: string;
  series_number?: any;
  seriesNumber?: any;
  seriesIndex?: any;
  genre?: string;
  age_range?: string;
  books?: any[];
}

interface Book {
  title: string;
  author: string;
  series: string | null;
  series_number: number | null;
  genre: string | null;
  age_range: string | null;
}

/**
 * Parse JSON response from Gemini (handles various formats)
 */
export function parseJsonResponse(content: string): Book[] {
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
 */
export function validateBooks(books: RawBook[]): Book[] {
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
 */
export function normalizeSeriesNumber(value: any): number | null {
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
