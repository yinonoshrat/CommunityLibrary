/**
 * Error codes for image-based book detection
 * Each error code has:
 * - code: Machine-readable error identifier
 * - message: User-friendly error message
 * - canRetry: Whether the user should retry
 * - statusCode: HTTP status code to return
 */

export const DETECTION_ERROR_CODES = {
  INVALID_IMAGE: {
    code: 'INVALID_IMAGE',
    message: 'Invalid image format. Please upload a JPEG or PNG image.',
    canRetry: false,
    statusCode: 400
  },
  
  CORRUPT_IMAGE: {
    code: 'CORRUPT_IMAGE',
    message: 'Image file is corrupted or unreadable. Please try another image.',
    canRetry: false,
    statusCode: 400
  },
  
  IMAGE_TOO_LARGE: {
    code: 'IMAGE_TOO_LARGE',
    message: 'Image is too large. Maximum 10MB allowed.',
    canRetry: false,
    statusCode: 413
  },
  
  OCR_FAILED: {
    code: 'OCR_FAILED',
    message: 'Failed to extract text from image. Please try a clearer image.',
    canRetry: true,
    statusCode: 422
  },
  
  AI_FAILED: {
    code: 'AI_FAILED',
    message: 'Failed to identify books. Please try another image.',
    canRetry: true,
    statusCode: 422
  },
  
  TIMEOUT: {
    code: 'TIMEOUT',
    message: 'Processing took too long. Please try a simpler image.',
    canRetry: true,
    statusCode: 504
  },
  
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    message: 'Processing limit reached. Please try again in a few minutes.',
    canRetry: true,
    statusCode: 429
  },
  
  SERVICE_UNAVAILABLE: {
    code: 'SERVICE_UNAVAILABLE',
    message: 'Processing service is temporarily unavailable. Please try again later.',
    canRetry: true,
    statusCode: 503
  },
  
  UNEXPECTED_ERROR: {
    code: 'UNEXPECTED_ERROR',
    message: 'An unexpected error occurred. Please try again.',
    canRetry: true,
    statusCode: 500
  },
  
  NO_BOOKS_DETECTED: {
    code: 'NO_BOOKS_DETECTED',
    message: 'No books detected in image. Please try an image with more visible book information.',
    canRetry: true,
    statusCode: 422
  },
  
  DATABASE_ERROR: {
    code: 'DATABASE_ERROR',
    message: 'Failed to save detection results. Please try again.',
    canRetry: true,
    statusCode: 500
  }
};

/**
 * Map error code to response
 * @param {string} errorCode - Error code from DETECTION_ERROR_CODES
 * @returns {Object} Error response object
 */
export function getErrorResponse(errorCode) {
  const error = DETECTION_ERROR_CODES[errorCode] || DETECTION_ERROR_CODES.UNEXPECTED_ERROR;
  return {
    code: error.code,
    message: error.message,
    canRetry: error.canRetry
  };
}

/**
 * Get error from detection result
 * @param {Object} result - Result from HybridVisionService.detectBooksFromImage()
 * @returns {Object|null} Error response or null if no error
 */
export function extractDetectionError(result) {
  if (result.errorCode) {
    return getErrorResponse(result.errorCode);
  }
  return null;
}
