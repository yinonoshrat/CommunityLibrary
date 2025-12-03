/**
 * Abstract AI Vision Service
 * 
 * Base class for AI vision services that detect books from images.
 * Allows easy switching between different AI providers (Gemini, OpenAI, Azure, etc.)
 */
class AIVisionService {
  /**
   * Detect books from an image buffer
   * @param {Buffer} imageBuffer - The image data
   * @returns {Promise<Array<{title: string, author: string}>>} - Array of detected books
   */
  async detectBooksFromImage(imageBuffer) {
    throw new Error('detectBooksFromImage must be implemented by subclass');
  }

  /**
   * Validate image buffer
   * @param {Buffer} imageBuffer - The image data
   * @returns {boolean} - Whether the image is valid
   */
  validateImage(imageBuffer) {
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Invalid image: buffer is empty');
    }
    
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (imageBuffer.length > maxSize) {
      throw new Error('Image too large: maximum size is 10MB');
    }
    
    return true;
  }
}

export default AIVisionService;
