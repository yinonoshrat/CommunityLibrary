/**
 * Image Storage Utility Module
 * Handles image uploads, thumbnail generation, signed URL creation, and cleanup
 * for the detection job system
 */

import sharp from 'sharp';

/**
 * Generate thumbnail from image buffer
 * Compresses image to max 500KB for database storage
 * @param {Buffer} imageBuffer - Original image buffer
 * @returns {Promise<string>} - Base64 encoded thumbnail
 */
export async function generateThumbnail(imageBuffer) {
  try {
    let thumbnail = await sharp(imageBuffer)
      .resize(400, 600, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 70, progressive: true })
      .toBuffer();

    // If still too large, reduce quality
    if (thumbnail.length > 500 * 1024) {
      thumbnail = await sharp(imageBuffer)
        .resize(300, 450, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 50, progressive: true })
        .toBuffer();
    }

    // Final check - if still too large, reduce dimensions again
    if (thumbnail.length > 500 * 1024) {
      thumbnail = await sharp(imageBuffer)
        .resize(250, 350, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 40, progressive: true })
        .toBuffer();
    }

    return thumbnail.toString('base64');
  } catch (error) {
    console.error('Thumbnail generation failed:', error);
    // Fallback: return small placeholder
    return null;
  }
}

/**
 * Get file extension from MIME type
 * @param {string} mimeType - MIME type (e.g., 'image/jpeg')
 * @returns {string} - File extension (e.g., 'jpg')
 */
export function getFileExtension(mimeType) {
  const mimeMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp'
  };
  return mimeMap[mimeType] || 'jpg';
}

/**
 * Upload image to Supabase Storage
 * @param {Object} supabase - Supabase client
 * @param {string} userId - User ID
 * @param {string} jobId - Detection job ID
 * @param {Buffer} imageBuffer - Image file buffer
 * @param {string} mimeType - MIME type
 * @returns {Promise<{path: string, url: string}>} - Storage path and signed URL
 */
export async function uploadImageToStorage(supabase, userId, jobId, imageBuffer, mimeType) {
  const ext = getFileExtension(mimeType);
  const fileName = `original.${ext}`;
  const storagePath = `${userId}/${jobId}/${fileName}`;

  try {
    // Upload original image
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('detection-job-images')
      .upload(storagePath, imageBuffer, {
        cacheControl: '86400', // Cache for 24 hours
        contentType: mimeType,
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Create signed URL (valid for 7 days)
    const { data: signedData, error: signedError } = await supabase
      .storage
      .from('detection-job-images')
      .createSignedUrl(storagePath, 7 * 24 * 60 * 60); // 7 days in seconds

    if (signedError) {
      throw new Error(`Signed URL creation failed: ${signedError.message}`);
    }

    return {
      path: storagePath,
      url: signedData.signedUrl,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
  } catch (error) {
    console.error('Image upload to storage failed:', error.message);
    throw error;
  }
}

/**
 * Delete image from Supabase Storage
 * @param {Object} supabase - Supabase client
 * @param {string} storagePath - Path to image in storage
 * @returns {Promise<boolean>} - True if deleted, false if not found
 */
export async function deleteImageFromStorage(supabase, storagePath) {
  if (!storagePath) return false;

  try {
    const { error } = await supabase
      .storage
      .from('detection-job-images')
      .remove([storagePath]);

    if (error) {
      // Treat 404 as success (already deleted)
      if (error.message?.includes('not found') || error.statusCode === 404) {
        return true;
      }
      throw error;
    }

    return true;
  } catch (error) {
    console.error(`Failed to delete image ${storagePath}:`, error.message);
    return false;
  }
}

/**
 * Create new signed URL for existing image
 * Useful for refreshing expired URLs
 * @param {Object} supabase - Supabase client
 * @param {string} storagePath - Path to image in storage
 * @returns {Promise<string|null>} - New signed URL or null if failed
 */
export async function refreshSignedUrl(supabase, storagePath) {
  if (!storagePath) return null;

  try {
    const { data, error } = await supabase
      .storage
      .from('detection-job-images')
      .createSignedUrl(storagePath, 7 * 24 * 60 * 60); // 7 days

    if (error) {
      console.error(`Failed to create signed URL for ${storagePath}:`, error.message);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Signed URL creation failed:', error.message);
    return null;
  }
}

/**
 * Validate image file
 * @param {Object} file - Multer file object
 * @param {number} maxSizeMB - Max file size in MB (default: 10)
 * @returns {{valid: boolean, error?: string}} - Validation result
 */
export function validateImageFile(file, maxSizeMB = 10) {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check MIME type
  if (!file.mimetype.startsWith('image/')) {
    return { valid: false, error: 'Only image files are allowed' };
  }

  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit` };
  }

  // Validate supported formats
  const supportedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!supportedMimes.includes(file.mimetype)) {
    return { valid: false, error: 'Unsupported image format. Use JPEG, PNG, GIF, or WebP' };
  }

  return { valid: true };
}

/**
 * Calculate storage usage for a user
 * @param {Object} supabase - Supabase client
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Total size in bytes
 */
export async function calculateUserStorageUsage(supabase, userId) {
  try {
    const { data, error } = await supabase
      .storage
      .from('detection-job-images')
      .list(userId);

    if (error) {
      console.error('Failed to list user files:', error);
      return 0;
    }

    // Recursively sum file sizes
    let totalSize = 0;
    
    const processFiles = async (path) => {
      const { data: files, error } = await supabase
        .storage
        .from('detection-job-images')
        .list(path);

      if (error) return;

      for (const file of files || []) {
        if (file.name === '.emptyFolderPlaceholder') continue;
        
        const fullPath = `${path}/${file.name}`;
        if (file.metadata) {
          totalSize += file.metadata.size || 0;
        }
      }
    };

    await processFiles(userId);
    return totalSize;
  } catch (error) {
    console.error('Storage calculation failed:', error);
    return 0;
  }
}

/**
 * Estimate remaining quota for user
 * @param {Object} supabase - Supabase client
 * @param {string} userId - User ID
 * @param {number} quotaMB - User quota in MB (default: 1000)
 * @returns {Promise<{used: number, remaining: number, percentage: number}>} - Storage stats
 */
export async function getUserStorageQuota(supabase, userId, quotaMB = 1000) {
  const usedBytes = await calculateUserStorageUsage(supabase, userId);
  const quotaBytes = quotaMB * 1024 * 1024;
  const remainingBytes = Math.max(0, quotaBytes - usedBytes);

  return {
    used: Math.round(usedBytes / 1024 / 1024 * 100) / 100, // MB
    remaining: Math.round(remainingBytes / 1024 / 1024 * 100) / 100, // MB
    percentage: Math.round((usedBytes / quotaBytes) * 100)
  };
}

export default {
  generateThumbnail,
  getFileExtension,
  uploadImageToStorage,
  deleteImageFromStorage,
  refreshSignedUrl,
  validateImageFile,
  calculateUserStorageUsage,
  getUserStorageQuota
};
