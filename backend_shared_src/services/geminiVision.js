import { GoogleGenerativeAI } from '@google/generative-ai';
import AIVisionService from './aiVisionService.js';
import { generateBookDetectionPrompt } from './visionServiceUtils.js';

/**
 * Gemini Vision Service
 * 
 * Implementation of AIVisionService using Google's Gemini 1.5 Flash model
 * for detecting book titles and authors from bookshelf images.
 */
class GeminiVisionService extends AIVisionService {
  constructor() {
    super();
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  /**
   * Detect books from an image using Gemini Vision
   * @param {Buffer} imageBuffer - The image data
   * @returns {Promise<Array<{title: string, author: string}>>} - Array of detected books
   */
  async detectBooksFromImage(imageBuffer) {
    try {
      console.log('=== GeminiVisionService.detectBooksFromImage ===');
      console.log('Image buffer size:', imageBuffer.length, 'bytes');
      
      // Validate image
      this.validateImage(imageBuffer);
      console.log('Image validation passed');

      // Detect mime type from buffer
      let mimeType = 'image/jpeg'; // default
      const header = imageBuffer.slice(0, 12).toString('hex');
      
      if (header.startsWith('ffd8ff')) {
        mimeType = 'image/jpeg';
      } else if (header.startsWith('89504e47')) {
        mimeType = 'image/png';
      } else if (header.startsWith('47494638')) {
        mimeType = 'image/gif';
      } else if (header.startsWith('52494646') && header.includes('57454250')) {
        mimeType = 'image/webp';
      }
      
      console.log('Detected mime type:', mimeType);

      // Prepare the prompt for Gemini
      const prompt = generateBookDetectionPrompt();

      // Prepare image data for Gemini
      const imagePart = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: mimeType
        }
      };

      console.log('Calling Gemini API with image size:', imageBuffer.length, 'bytes');

      // Call Gemini API
      const result = await this.model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();

      console.log('Gemini response received, length:', text.length);
      console.log('Response preview:', text.substring(0, 200));

      // Parse JSON from response
      // Gemini might wrap the JSON in markdown code blocks, so we need to extract it
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      
      if (!jsonMatch) {
        console.warn('No JSON array found in Gemini response:', text);
        return [];
      }

      const booksData = JSON.parse(jsonMatch[0]);

      // Validate and clean the data
      const books = booksData
        .filter(book => book.title && typeof book.title === 'string')
        .map(book => ({
          title: book.title.trim(),
          author: book.author ? book.author.trim() : '',
          series: book.series || null,
          series_number: book.series_number || null,
          genre: book.genre || null,
          age_range: book.age_range || null
        }));

      console.log(`Successfully detected ${books.length} books from image`);
      return books;

    } catch (error) {
      console.error('=== Gemini Vision error ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      if (error.message?.includes('API key')) {
        throw new Error('Invalid or missing Gemini API key');
      }
      
      if (error.message?.includes('quota')) {
        throw new Error('Gemini API quota exceeded. Please try again later.');
      }
      
      if (error instanceof SyntaxError) {
        throw new Error('Failed to parse AI response. The image might not contain readable books.');
      }
      
      throw new Error(`AI detection failed: ${error.message}`);
    }
  }
}

export default GeminiVisionService;
