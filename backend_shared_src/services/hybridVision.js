import { ImageAnnotatorClient } from '@google-cloud/vision';
import { GoogleGenerativeAI } from '@google/generative-ai';
import AIVisionService from './aiVisionService.js';

/**
 * Hybrid Vision Service
 * 
 * Two-step approach:
 * 1. Use Google Cloud Vision OCR to extract all text from the image
 * 2. Send OCR results + image to Gemini to infer book titles and authors
 * 
 * This provides better accuracy for complex layouts and mixed languages.
 */
class HybridVisionService extends AIVisionService {
  constructor(options = {}) {
    super();
    
    // Check for Google Cloud credentials
    const googleCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_CREDENTIALS;
    if (!googleCredentials && !process.env.GOOGLE_CLOUD_PROJECT) {
      throw new Error('Google Cloud credentials required: Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CLOUD_CREDENTIALS');
    }
    
    // Check for Gemini API key
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    // Initialize Google Cloud Vision
    const visionConfig = {};
    if (googleCredentials) {
      try {
        // Check if it's base64 encoded
        let credentialsString = googleCredentials;
        
        // Test if it's base64 by checking if it decodes to valid JSON
        if (!credentialsString.startsWith('{') && !credentialsString.startsWith('/')) {
          try {
            const decoded = Buffer.from(credentialsString, 'base64').toString('utf-8');
            // Verify it's valid JSON
            JSON.parse(decoded);
            console.log('Detected base64-encoded credentials, decoding...');
            credentialsString = decoded;
          } catch (base64Error) {
            // Not base64 or invalid JSON after decode, continue with original
          }
        }
        
        // Try parsing as JSON (if it's the actual credentials JSON)
        const credentials = JSON.parse(credentialsString);
        visionConfig.credentials = credentials;
      } catch (e) {
        // It's a file path
        visionConfig.keyFilename = googleCredentials;
      }
    }
    
    this.visionClient = new ImageAnnotatorClient(visionConfig);
    
    // Initialize Gemini with configurable model
    const modelName = options.geminiModel || 'gemini-2.5-flash';
    this.genAI = new GoogleGenerativeAI(geminiKey);
    const systemInstruction = "You are a Hebrew assistant. When outputting Hebrew abbreviations (Rashei Tevot), you must strictly use the Hebrew Gershayim character (״) (Unicode U+05F4) or single quotes ('). NEVER use a standard double quote (\") inside a JSON string value unless it is escaped with a backslash.";  
        
    this.model = this.genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0,
      }
    });
    this.modelName = modelName;
    
    console.log(`Hybrid Vision Service initialized (Google Cloud Vision OCR + ${modelName})`);
  }

  /**
   * Detect books using OCR + AI inference
   * @param {Buffer} imageBuffer - The image data
   * @returns {Promise<Array<{title: string, author: string}>>} - Array of detected books
   */
  async detectBooksFromImage(imageBuffer) {
    try {
      console.log('=== HybridVisionService.detectBooksFromImage ===');
      console.log('Image buffer size:', imageBuffer.length, 'bytes');

      // Validate image
      this.validateImage(imageBuffer);

      // Step 1: Extract text using Google Cloud Vision OCR
      console.log('Step 1: Running OCR with Google Cloud Vision...');
      const ocrData = await this.extractTextWithOCR(imageBuffer);
      
      if (!ocrData.fullText || ocrData.fullText.trim().length === 0) {
        console.warn('No text detected by OCR');
        return [];
      }
      
      console.log(`OCR extracted ${ocrData.fullText.length} characters in ${ocrData.blocks.length} text blocks`);
      console.log('Sample OCR text:', ocrData.fullText.substring(0, 2000) + '...');

      // Step 2: Use Gemini to infer books from OCR data + image
      console.log('Step 2: Analyzing with Gemini to identify books...');
      const books = await this.inferBooksWithGemini(imageBuffer, ocrData);
      
      console.log(`Successfully identified ${books.length} books`);
      
      return books;

    } catch (error) {
      console.error('Hybrid Vision error:', error);
      
      if (error.code) {
        console.error('Error code:', error.code);
      }
      if (error.details) {
        console.error('Error details:', error.details);
      }
      
      throw new Error(`Failed to detect books: ${error.message}`);
    }
  }

  /**
   * Extract text from image using Google Cloud Vision OCR
   * @param {Buffer} imageBuffer - The image data
   * @returns {Promise<Object>} - Structured OCR data with text blocks and positioning
   */
  async extractTextWithOCR(imageBuffer) {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`OCR attempt ${attempt}/${maxRetries}...`);
        
        const [result] = await this.visionClient.textDetection({
          image: { content: imageBuffer }
        });

        const detections = result.textAnnotations;
        
        if (!detections || detections.length === 0) {
          return { fullText: '', blocks: [] };
        }

        // The first annotation contains all detected text
        const fullText = detections[0]?.description || '';
        
        // Extract individual text blocks with positioning (skip first element which is full text)
        const blocks = detections.slice(1).map((annotation, index) => {
          const bounds = annotation.boundingPoly?.vertices || [];
          
          // Calculate center point for positioning
          const centerX = bounds.length > 0 
            ? bounds.reduce((sum, v) => sum + (v.x || 0), 0) / bounds.length 
            : 0;
          const centerY = bounds.length > 0 
            ? bounds.reduce((sum, v) => sum + (v.y || 0), 0) / bounds.length 
            : 0;
          
          // Calculate text orientation (vertical or horizontal)
          const width = bounds.length >= 2 
            ? Math.abs((bounds[1]?.x || 0) - (bounds[0]?.x || 0))
            : 0;
          const height = bounds.length >= 3
            ? Math.abs((bounds[2]?.y || 0) - (bounds[0]?.y || 0))
            : 0;
          const isVertical = height > width * 1.5;
          
          return {
            text: annotation.description,
            confidence: annotation.confidence || 0,
            position: {
              centerX: Math.round(centerX),
              centerY: Math.round(centerY),
              top: bounds[0]?.y || 0,
              left: bounds[0]?.x || 0
            },
            orientation: isVertical ? 'vertical' : 'horizontal',
            index
          };
        });
        
        // Sort blocks by position (top-to-bottom, left-to-right)
        blocks.sort((a, b) => {
          const yDiff = a.position.top - b.position.top;
          // If on roughly the same horizontal line (within 20px), sort by x
          if (Math.abs(yDiff) < 20) {
            return a.position.left - b.position.left;
          }
          return yDiff;
        });
        
        console.log(`OCR detected ${blocks.length} text blocks`);
        
        return { fullText, blocks };

      } catch (error) {
        lastError = error;
        console.error(`OCR attempt ${attempt} failed:`, error.message);
        
        if (error.code === 'UNAVAILABLE' || error.code === 'DEADLINE_EXCEEDED' || 
            error.message?.includes('fetch') || error.message?.includes('network')) {
          console.error('Network/timeout error - retrying...');
          // Wait before retrying (exponential backoff)
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
            console.log(`Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // Don't retry for authentication or permission errors
        if (error.code === 'PERMISSION_DENIED' || error.code === 'UNAUTHENTICATED') {
          console.error('Authentication error - not retrying');
          break;
        }
        
        // Don't retry for other errors
        break;
      }
    }

    console.error('All OCR attempts failed');
    throw new Error(`OCR failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Use Gemini to infer book titles and authors from OCR data and image
   * @param {Buffer} imageBuffer - The image data
   * @param {Object} ocrData - Structured OCR data with fullText and blocks
   * @returns {Promise<Array>} - Array of books
   */
  async inferBooksWithGemini(imageBuffer, ocrData) {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const mimeType = this.detectMimeType(imageBuffer);
        const base64Image = imageBuffer.toString('base64');

        // Create structured text summary for Gemini
        const structuredText = this.formatStructuredOCR(ocrData);
        const prompt = `You are analyzing a bookshelf image to identify book titles and authors.

I have already extracted the text visible in the image using OCR. The text is organized with positioning and orientation information:

--- STRUCTURED OCR DATA START ---
${structuredText}
--- STRUCTURED OCR DATA END ---

Your task:
1. Look at the image to see the physical books (spines, covers, arrangement)
2. Use the structured OCR data to understand which text blocks belong together
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

        console.log(`Sending structured OCR data + image to Gemini (attempt ${attempt}/${maxRetries})...`);

        const result = await this.model.generateContent([
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          }
        ]);

        const response = await result.response;
        const text = response.text();

        console.log('Gemini raw response:', text);

        // Parse the JSON response
        const books = this.parseJsonResponse(text);

        return books;

      } catch (error) {
        lastError = error;
        console.error(`Gemini inference attempt ${attempt} failed:`, error.message);
        
        if (error.message?.includes('fetch failed')) {
          console.error('Network error - retrying...');
          // Wait before retrying (exponential backoff)
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
            console.log(`Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // Don't retry for other errors
        break;
      }
    }

    console.error('All Gemini inference attempts failed');
    throw new Error(`Gemini inference failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Format structured OCR data for Gemini prompt
   * @param {Object} ocrData - OCR data with fullText and blocks
   * @returns {string} - Formatted text for prompt
   */
  formatStructuredOCR(ocrData) {
    const lines = ['Full text preview:', ocrData.fullText.substring(0, 300) + '...', '', 'Structured text blocks:'];
    
    // Group blocks by vertical proximity (likely same book spine)
    const groupedBlocks = this.groupTextBlocks(ocrData.blocks);
    
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
  groupTextBlocks(blocks) {
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
   * Detect MIME type from image buffer
   * @param {Buffer} buffer - Image buffer
   * @returns {string} - MIME type
   */
  detectMimeType(buffer) {
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

  /**
   * Parse JSON response from Gemini (handles various formats)
   * @param {string} content - Response content
   * @returns {Array} - Array of books
   */
  parseJsonResponse(content) {
    try {
      // Try direct JSON parse first
      const parsed = JSON.parse(content);
      
      if (Array.isArray(parsed)) {
        return this.validateBooks(parsed);
      }
      
      if (parsed.books && Array.isArray(parsed.books)) {
        return this.validateBooks(parsed.books);
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
            return this.validateBooks(parsed);
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
  validateBooks(books) {
    return books
      .filter(book => {
        // Must be an object with a title
        if (!book || typeof book !== 'object' || !book.title) {
          return false
        }
        
        // Title must be meaningful (at least 2 characters, not just punctuation)
        const title = String(book.title).trim()
        if (title.length < 2) {
          return false
        }        
        
        return true
      })
      .map(book => ({
        title: String(book.title).trim(),
        author: book.author ? String(book.author).trim() : '',
        series: book.series ? String(book.series).trim() : (book.series_title ? String(book.series_title).trim() : null),
        series_number: this.normalizeSeriesNumber(
          book.series_number ?? book.seriesNumber ?? book.seriesIndex ?? null
        ),
        genre: book.genre ? String(book.genre).trim() : null,
        age_range: book.age_range ? String(book.age_range).trim() : null
      }));
  }

  normalizeSeriesNumber(value) {
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
}

export default HybridVisionService;
