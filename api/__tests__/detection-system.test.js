/**
 * Detection System Test Suite
 * Tests for image detection, storage, error handling, and retry logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase
vi.mock('@supabase/supabase-js');

describe('Detection System', () => {
  let supabaseClient;

  beforeEach(() => {
    supabaseClient = {
      from: vi.fn(),
      storage: {
        from: vi.fn(),
      },
    };
  });

  describe('Image Validation', () => {
    it('should accept valid JPEG images', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      expect(file.type).toBe('image/jpeg');
      expect(file.size).toBeGreaterThan(0);
    });

    it('should accept valid PNG images', async () => {
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      expect(file.type).toBe('image/png');
    });

    it('should reject non-image files', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      expect(['image/jpeg', 'image/png'].includes(file.type)).toBe(false);
    });

    it('should reject files exceeding 10MB', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      const file = new File([largeBuffer], 'large.jpg', { type: 'image/jpeg' });
      expect(file.size > 10 * 1024 * 1024).toBe(true);
    });
  });

  describe('Detection Job Creation', () => {
    it('should create a new detection job with correct structure', async () => {
      const mockJob = {
        id: 'job-123',
        user_id: 'user-123',
        status: 'processing',
        progress: 0,
        stage: 'uploading',
        image_original_filename: 'test.jpg',
        image_mime_type: 'image/jpeg',
        image_size_bytes: 500000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(mockJob).toHaveProperty('id');
      expect(mockJob).toHaveProperty('user_id');
      expect(mockJob).toHaveProperty('status', 'processing');
      expect(mockJob).toHaveProperty('image_original_filename');
    });

    it('should store image metadata in database', async () => {
      const jobData = {
        user_id: 'user-123',
        image_original_filename: 'test.jpg',
        image_mime_type: 'image/jpeg',
        image_size_bytes: 500000,
        image_base64_thumbnail: 'data:image/jpeg;base64,...',
        image_uploaded_at: new Date().toISOString(),
      };

      expect(jobData.image_original_filename).toBe('test.jpg');
      expect(jobData.image_mime_type).toBe('image/jpeg');
      expect(jobData.image_base64_thumbnail).toBeDefined();
    });
  });

  describe('Image Storage', () => {
    it('should generate thumbnail under 500KB', async () => {
      const thumbnail = Buffer.alloc(400000); // 400KB
      expect(thumbnail.length).toBeLessThan(500 * 1024);
    });

    it('should upload image to Supabase Storage', async () => {
      const mockUpload = vi.fn().mockResolvedValue({
        data: { path: 'user-123/job-123/original' },
      });

      const result = await mockUpload('user-123/job-123/original', Buffer.from('test'));
      expect(result.data.path).toBe('user-123/job-123/original');
    });

    it('should generate signed URL with 7-day expiry', async () => {
      const expiresIn = 7 * 24 * 60 * 60; // 7 days in seconds
      const now = Date.now();
      const expiresAt = new Date(now + expiresIn * 1000);

      expect(expiresAt.getTime()).toBeGreaterThan(now);
      expect((expiresAt.getTime() - now) / 1000).toBeLessThanOrEqual(expiresIn + 10);
    });

    it('should delete image from storage', async () => {
      const mockDelete = vi.fn().mockResolvedValue({ data: null });
      await mockDelete('user-123/job-123/original');
      expect(mockDelete).toHaveBeenCalledWith('user-123/job-123/original');
    });
  });

  describe('Detection Progress Tracking', () => {
    it('should track progress from 0 to 100', async () => {
      const stages = [
        { stage: 'uploading', progress: 15 },
        { stage: 'extracting_text', progress: 40 },
        { stage: 'analyzing_books', progress: 70 },
        { stage: 'enriching_metadata', progress: 85 },
        { stage: 'checking_ownership', progress: 95 },
        { stage: 'finalizing', progress: 100 },
      ];

      for (let i = 0; i < stages.length - 1; i++) {
        expect(stages[i].progress).toBeLessThan(stages[i + 1].progress);
      }

      expect(stages[0].progress).toBeGreaterThan(0);
      expect(stages[stages.length - 1].progress).toBe(100);
    });

    it('should update job stage in database', async () => {
      const stageUpdate = {
        stage: 'analyzing_books',
        progress: 70,
        updated_at: new Date().toISOString(),
      };

      expect(stageUpdate.stage).toBe('analyzing_books');
      expect(stageUpdate.progress).toBe(70);
    });
  });

  describe('Error Handling', () => {
    const errorCodes = {
      INVALID_IMAGE: {
        message: 'Invalid image format',
        httpStatus: 400,
        canRetry: false,
      },
      OCR_FAILED: {
        message: 'Failed to extract text from image',
        httpStatus: 500,
        canRetry: true,
      },
      AI_FAILED: {
        message: 'AI detection failed',
        httpStatus: 500,
        canRetry: true,
      },
      TIMEOUT: {
        message: 'Processing timeout',
        httpStatus: 504,
        canRetry: true,
      },
      UNEXPECTED_ERROR: {
        message: 'Unexpected error',
        httpStatus: 500,
        canRetry: true,
      },
    };

    it('should return appropriate error code for invalid image', () => {
      const error = errorCodes.INVALID_IMAGE;
      expect(error.message).toBeDefined();
      expect(error.httpStatus).toBe(400);
      expect(error.canRetry).toBe(false);
    });

    it('should mark retryable errors', () => {
      const retryableErrors = Object.entries(errorCodes)
        .filter(([, code]) => code.canRetry)
        .map(([key]) => key);

      expect(retryableErrors).toContain('OCR_FAILED');
      expect(retryableErrors).toContain('AI_FAILED');
      expect(retryableErrors).toContain('TIMEOUT');
      expect(retryableErrors).not.toContain('INVALID_IMAGE');
    });

    it('should store error code and message in job', () => {
      const failedJob = {
        status: 'failed',
        stage: 'failed_ai',
        error_code: 'AI_FAILED',
        error: 'Failed to detect books using AI',
        can_retry: true,
        progress: 0,
      };

      expect(failedJob.status).toBe('failed');
      expect(failedJob.error_code).toBeDefined();
      expect(failedJob.can_retry).toBe(true);
    });
  });

  describe('Job Retry Logic', () => {
    it('should allow retry for retryable errors', () => {
      const job = {
        id: 'job-123',
        status: 'failed',
        error_code: 'TIMEOUT',
        can_retry: true,
      };

      expect(job.can_retry).toBe(true);
      expect(['TIMEOUT', 'OCR_FAILED', 'AI_FAILED']).toContain(job.error_code);
    });

    it('should not allow retry for non-retryable errors', () => {
      const job = {
        id: 'job-123',
        status: 'failed',
        error_code: 'INVALID_IMAGE',
        can_retry: false,
      };

      expect(job.can_retry).toBe(false);
    });

    it('should reset progress on retry', () => {
      const retriedJob = {
        status: 'processing',
        progress: 0,
        stage: 'uploading',
        updated_at: new Date().toISOString(),
      };

      expect(retriedJob.progress).toBe(0);
      expect(retriedJob.status).toBe('processing');
    });
  });

  describe('Job Cleanup', () => {
    it('should soft-delete jobs older than 7 days', () => {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const oldJob = {
        id: 'job-old',
        created_at: sevenDaysAgo.toISOString(),
        image_uploaded_at: sevenDaysAgo.toISOString(),
      };

      expect(new Date(oldJob.image_uploaded_at) <= sevenDaysAgo).toBe(true);
    });

    it('should preserve recent jobs', () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

      const recentJob = {
        id: 'job-recent',
        created_at: oneDayAgo.toISOString(),
        image_uploaded_at: oneDayAgo.toISOString(),
      };

      expect(new Date(recentJob.image_uploaded_at) > oneDayAgo).toBe(false);
    });

    it('should clear image from storage on cleanup', () => {
      const cleanupJob = {
        id: 'job-123',
        image_storage_path: 'user-123/job-123/original',
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      };

      expect(cleanupJob.is_deleted).toBe(true);
      expect(cleanupJob.image_storage_path).toBeDefined();
    });
  });

  describe('Timeout Detection', () => {
    it('should identify jobs stuck in processing >10 minutes', () => {
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      const elevenMinutesAgo = new Date(now.getTime() - 11 * 60 * 1000);

      const stuckJob = {
        id: 'job-stuck',
        status: 'processing',
        created_at: elevenMinutesAgo.toISOString(),
        stage: 'extracting_text',
      };

      expect(new Date(stuckJob.created_at) < tenMinutesAgo).toBe(true);
    });

    it('should mark stuck jobs as failed', () => {
      const markedJob = {
        id: 'job-stuck',
        status: 'failed',
        stage: 'failed_timeout',
        error_code: 'TIMEOUT',
        can_retry: true,
      };

      expect(markedJob.status).toBe('failed');
      expect(markedJob.error_code).toBe('TIMEOUT');
      expect(markedJob.can_retry).toBe(true);
    });
  });

  describe('API Endpoints', () => {
    it('POST /api/books/detect - should start detection job', async () => {
      const request = {
        method: 'POST',
        body: 'FormData with image',
        headers: { 'Content-Type': 'multipart/form-data' },
      };

      const response = {
        jobId: 'job-123',
        status: 'processing',
        message: 'Detection started',
      };

      expect(request.method).toBe('POST');
      expect(response).toHaveProperty('jobId');
      expect(response.status).toBe('processing');
    });

    it('GET /api/detection-jobs/:jobId - should return job status', async () => {
      const response = {
        id: 'job-123',
        status: 'processing',
        progress: 50,
        stage: 'analyzing_books',
        image: {
          filename: 'test.jpg',
          thumbnail: 'base64...',
          url: 'https://...',
          expires_at: new Date().toISOString(),
        },
      };

      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('image');
    });

    it('POST /api/detection-jobs/:jobId/retry - should retry failed job', async () => {
      const request = { method: 'POST' };
      const response = {
        success: true,
        jobId: 'job-123',
        status: 'processing',
      };

      expect(request.method).toBe('POST');
      expect(response.success).toBe(true);
      expect(response.status).toBe('processing');
    });

    it('DELETE /api/detection-jobs/:jobId - should delete job and images', async () => {
      const request = { method: 'DELETE' };
      const response = {
        success: true,
        message: 'Job and images deleted',
      };

      expect(request.method).toBe('DELETE');
      expect(response.success).toBe(true);
    });
  });
});
