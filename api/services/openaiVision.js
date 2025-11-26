import OpenAI from 'openai';
import AIVisionService from './aiVisionService.js';

/**
 * OpenAI Vision Service
 * 
 * Implementation of AIVisionService using OpenAI's GPT-4o-mini model
 * for detecting book titles and authors from bookshelf images.
 */
class OpenAIVisionService extends AIVisionService {
  constructor() {
    super();
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Detect books from an image using GPT-4o-mini Vision
   * @param {Buffer} imageBuffer - The image data
   * @returns {Promise<Array<{title: string, author: string}>>} - Array of detected books
   */
  async detectBooksFromImage(imageBuffer) {
    try {
      console.log('=== OpenAIVisionService.detectBooksFromImage ===');
      console.log('Image buffer size:', imageBuffer.length, 'bytes');

      // Validate image
      this.validateImage(imageBuffer);

      // Convert buffer to base64
      const base64Image = imageBuffer.toString('base64');
      const mimeType = this.detectMimeType(imageBuffer);
      
      console.log('Detected MIME type:', mimeType);

      const prompt = `Analyze this image of a bookshelf and extract all visible book titles and authors.

For each book you can clearly identify, provide:
1. The exact title as written on the spine or cover
2. The author's name (if visible)

Return ONLY a JSON array with this exact structure:
[
  {
    "title": "exact book title",
    "author": "author name or empty string if not visible"
  }
]

Important:
- Only include books where you can clearly read the title
- If author is not visible, use empty string ""
- Return valid JSON array only, no additional text
- Support Hebrew and English text
- Be precise with the text you see`;

      console.log('Sending request to OpenAI GPT-4o-mini...');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: "system",
                content:
                "You extract book titles from book spines in images. Return ONLY JSON in the format: { books: [ { title: '...' } ] }",
            },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
      });

      console.log('OpenAI response received');
      console.log('Usage:', response.usage);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      console.log('Raw response:', content);

      // Parse JSON response
      const books = this.parseJsonResponse(content);
      
      console.log(`Successfully detected ${books.length} books`);
      
      return books;

    } catch (error) {
      console.error('OpenAI Vision error:', error);
      
      if (error.response) {
        console.error('API error response:', error.response.data);
      }
      
      throw new Error(`Failed to detect books: ${error.message}`);
    }
  }

  /**
   * Detect MIME type from image buffer
   * @param {Buffer} buffer - Image buffer
   * @returns {string} - MIME type
   */
  detectMimeType(buffer) {
    // Check magic numbers (file signatures)
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
    
    // Default to JPEG if unknown
    console.warn('Unknown image format, defaulting to image/jpeg');
    return 'image/jpeg';
  }

  /**
   * Parse JSON response from OpenAI (handles various formats)
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
      
      // If it's an object with a books array
      if (parsed.books && Array.isArray(parsed.books)) {
        return this.validateBooks(parsed.books);
      }
      
      throw new Error('Response is not an array');
      
    } catch (parseError) {
      console.log('Direct JSON parse failed, trying to extract JSON from text');
      
      // Try to extract JSON array from markdown code blocks or text
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
      throw new Error('Could not parse JSON response from OpenAI');
    }
  }

  /**
   * Validate and clean books array
   * @param {Array} books - Raw books array
   * @returns {Array} - Validated books array
   */
  validateBooks(books) {
    return books
      .filter(book => book && typeof book === 'object' && book.title)
      .map(book => ({
        title: String(book.title).trim(),
        author: book.author ? String(book.author).trim() : ''
      }));
  }
}

export default OpenAIVisionService;
