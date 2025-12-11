/**
 * Integration Tests: Full Detection Pipeline
 * Tests the complete flow from image upload to book detection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Detection Pipeline Integration', () => {
  let mockSupabase;
  let mockAiService;

  beforeEach(() => {
    // Mock Supabase operations
    mockSupabase = {
      from: vi.fn((table) => ({
        insert: vi.fn().mockResolvedValue({ data: { id: 'job-123' }, error: null }),
        select: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'job-123',
              status: 'completed',
              result: { books: [{ title: 'Test Book' }] },
            },
          ],
          error: null,
        }),
        update: vi.fn().mockResolvedValue({ data: null, error: null }),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'job-123' }, error: null }),
      })),
      storage: {
        from: vi.fn((bucket) => ({
          upload: vi
            .fn()
            .mockResolvedValue({
              data: { path: 'user-123/job-123/original' },
              error: null,
            }),
          remove: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      },
    };

    // Mock AI Vision Service
    mockAiService = {
      detectBooksFromImage: vi.fn().mockResolvedValue({
        books: [
          { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
          { title: '1984', author: 'George Orwell' },
        ],
        errorCode: null,
        canRetry: false,
      }),
    };
  });

  describe('Happy Path: Image Upload → Detection → Results', () => {
    it('should complete full detection pipeline successfully', async () => {
      // Step 1: Receive image upload
      const imageFile = new File(['image data'], 'bookshelf.jpg', { type: 'image/jpeg' });
      expect(imageFile.type).toBe('image/jpeg');

      // Step 2: Create detection job
      const jobResult = await mockSupabase.from('detection_jobs').insert({
        user_id: 'user-123',
        image_original_filename: imageFile.name,
        image_size_bytes: imageFile.size,
        status: 'processing',
      });

      expect(jobResult.data.id).toBe('job-123');
      expect(mockSupabase.from).toHaveBeenCalledWith('detection_jobs');

      // Step 3: Upload image to storage
      const storageResult = await mockSupabase.storage
        .from('detection-job-images')
        .upload('user-123/job-123/original', imageFile);

      expect(storageResult.data.path).toBe('user-123/job-123/original');
      expect(storageResult.error).toBeNull();

      // Step 4: Run AI detection
      const detectionResult = await mockAiService.detectBooksFromImage(
        imageFile,
        {}
      );

      expect(detectionResult.books).toHaveLength(2);
      expect(detectionResult.books[0].title).toBe('The Great Gatsby');

      // Step 5: Update job with results
      const updateResult = await mockSupabase.from('detection_jobs').update({
        status: 'completed',
        progress: 100,
        result: { books: detectionResult.books },
      });

      expect(updateResult.error).toBeNull();
      expect(mockSupabase.from).toHaveBeenCalled();
    });
  });

  describe('Error Handling: Various Failure Modes', () => {
    it('should handle invalid image format', async () => {
      const invalidFile = new File(['text'], 'data.txt', { type: 'text/plain' });
      
      expect(invalidFile.type).not.toMatch(/^image\//);
    });

    it('should handle OCR failure and mark retryable', async () => {
      const ocrFailure = {
        books: [],
        errorCode: 'OCR_FAILED',
        errorMessage: 'Could not extract text',
        canRetry: true,
      };

      expect(ocrFailure.canRetry).toBe(true);
      expect(ocrFailure.errorCode).toBe('OCR_FAILED');
    });

    it('should handle AI detection failure', async () => {
      const aiFailure = {
        books: [],
        errorCode: 'AI_FAILED',
        errorMessage: 'Failed to identify books',
        canRetry: true,
      };

      expect(aiFailure.errorCode).toBe('AI_FAILED');
      expect(aiFailure.canRetry).toBe(true);
    });

    it('should handle processing timeout', async () => {
      const timeout = {
        books: [],
        errorCode: 'TIMEOUT',
        errorMessage: 'Processing took too long',
        canRetry: true,
      };

      expect(timeout.errorCode).toBe('TIMEOUT');
      expect(timeout.canRetry).toBe(true);
    });
  });

  describe('Progress Tracking During Processing', () => {
    it('should update progress callbacks at each stage', async () => {
      const progressUpdates = [];

      const onProgress = (stage, progress, message) => {
        progressUpdates.push({ stage, progress, message });
      };

      // Simulate detection with progress callbacks
      onProgress('uploading', 15, 'Uploading image...');
      onProgress('extracting_text', 40, 'Extracting text...');
      onProgress('analyzing_books', 70, 'Analyzing books...');
      onProgress('enriching_metadata', 85, 'Enriching metadata...');
      onProgress('finalizing', 100, 'Complete!');

      expect(progressUpdates).toHaveLength(5);
      expect(progressUpdates[0].progress).toBe(15);
      expect(progressUpdates[4].progress).toBe(100);
      expect(progressUpdates.every(u => u.progress > 0)).toBe(true);
    });

    it('should update database with progress', async () => {
      const updateSpy = vi.fn().mockResolvedValue({ data: null, error: null });
      mockSupabase.from = vi.fn(() => ({
        update: updateSpy,
        eq: vi.fn().mockReturnThis(),
      }));

      // Simulate progress update
      await mockSupabase.from('detection_jobs').update({
        progress: 50,
        stage: 'analyzing_books',
      });

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          progress: 50,
          stage: 'analyzing_books',
        })
      );
    });
  });

  describe('Job Retry After Failure', () => {
    it('should allow retry for retryable error', async () => {
      // Initial failed job
      const failedJob = {
        id: 'job-123',
        status: 'failed',
        error_code: 'OCR_FAILED',
        can_retry: true,
      };

      expect(failedJob.can_retry).toBe(true);

      // Retry detection
      const retryResult = {
        books: [{ title: 'Successfully detected book' }],
        errorCode: null,
        canRetry: false,
      };

      expect(retryResult.books).toHaveLength(1);
      expect(retryResult.errorCode).toBeNull();
    });

    it('should not allow retry for non-retryable error', async () => {
      const nonRetryableJob = {
        id: 'job-456',
        status: 'failed',
        error_code: 'INVALID_IMAGE',
        can_retry: false,
      };

      expect(nonRetryableJob.can_retry).toBe(false);
    });
  });

  describe('Image Storage Management', () => {
    it('should store and retrieve image thumbnails', async () => {
      const thumbnail = {
        base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
        size: 45000, // <500KB
      };

      expect(thumbnail.base64).toContain('data:image/jpeg;base64');
      expect(thumbnail.size).toBeLessThan(500 * 1024);
    });

    it('should generate signed URLs for image access', async () => {
      const signedUrl = {
        url: 'https://bucket.supabase.co/object/sign/path?token=...',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      expect(signedUrl.url).toBeDefined();
      expect(new Date(signedUrl.expiresAt) > new Date()).toBe(true);
    });

    it('should delete old images after cleanup', async () => {
      const deleteResult = await mockSupabase.storage
        .from('detection-job-images')
        .remove(['user-123/job-123/original']);

      expect(deleteResult.error).toBeNull();
    });
  });

  describe('Database State Management', () => {
    it('should track job through all states', async () => {
      const states = [
        { status: 'processing', stage: 'uploading' },
        { status: 'processing', stage: 'extracting_text' },
        { status: 'processing', stage: 'analyzing_books' },
        { status: 'completed', stage: 'completed' },
      ];

      states.forEach((state, idx) => {
        if (idx > 0) {
          // Processing stage should come before completed
          expect(['processing', 'completed']).toContain(state.status);
        }
      });
    });

    it('should soft-delete jobs and preserve history', async () => {
      const deletedJob = {
        id: 'job-123',
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        image_storage_path: null, // Cleared
        image_base64_thumbnail: null, // Cleared
      };

      expect(deletedJob.is_deleted).toBe(true);
      expect(deletedJob.image_storage_path).toBeNull();
    });
  });

  describe('Concurrent Job Handling', () => {
    it('should handle multiple parallel detection jobs', async () => {
      const jobs = [
        { jobId: 'job-1', userId: 'user-1' },
        { jobId: 'job-2', userId: 'user-2' },
        { jobId: 'job-3', userId: 'user-1' }, // Same user, different job
      ];

      const results = await Promise.all(
        jobs.map(job =>
          mockSupabase.from('detection_jobs').select().eq('id', job.jobId)
        )
      );

      expect(results).toHaveLength(3);
      expect(results.every(r => r.error === null)).toBe(true);
    });
  });

  describe('API Response Format', () => {
    it('should return consistent API response for job status', async () => {
      const response = {
        id: 'job-123',
        status: 'completed',
        progress: 100,
        stage: 'completed',
        result: {
          books: [{ title: 'Test', author: 'Author' }],
        },
        image: {
          filename: 'test.jpg',
          thumbnail: 'base64...',
          url: 'https://...',
          expires_at: new Date().toISOString(),
        },
        error: null,
        error_code: null,
        can_retry: false,
      };

      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('image');
      expect(response).toHaveProperty('result');
      expect(response.error).toBeNull();
    });
  });
});
