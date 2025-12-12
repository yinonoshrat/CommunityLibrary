import express from 'express';
import multer from 'multer';
import {
  getAllBooks,
  searchBooks,
  getBookById,
  getBookFamilies,
  createBook,
  updateBook,
  deleteBook,
  getBookReviews,
  createBookReview,
  getBookLikes,
  toggleBookLike,
  detectBooksFromImage,
  getDetectionJob,
  getUserDetectionJobs,
  deleteDetectionJob,
  bulkAddBooks,
} from '../controllers/books.controller.js';
import { extractUserFromToken, requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

// Ensure user context is available for routes that require authentication
router.use(extractUserFromToken);

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  },
});

// Core book routes
router.get('/', getAllBooks);
router.get('/search', searchBooks);

// Bulk upload routes (async detection with polling) - MUST BE BEFORE /:id
router.get('/detect-jobs', requireAuth, getUserDetectionJobs);
router.get('/detect-job/:jobId', requireAuth, getDetectionJob);
router.delete('/detect-job/:jobId', requireAuth, deleteDetectionJob);
router.post('/detect-from-image',  
  requireAuth, 
  (req, res, next) => {
    console.log('[Route] /detect-from-image called');
    console.log('[Route] Starting Multer upload...');
    upload.single('image')(req, res, (err) => {
      if (err) {
        console.error('[Route] Multer error:', err);
        return res.status(400).json({ error: err.message });
      }
      console.log('[Route] Multer upload complete');
      if (req.file) {
        console.log(`[Route] File received: ${req.file.originalname}, ${req.file.size} bytes, ${req.file.mimetype}`);
      } else {
        console.warn('[Route] No file received in request');
      }
      next();
    });
  }, 
  detectBooksFromImage
);
router.post('/bulk-add', requireAuth, bulkAddBooks);

router.get('/:id', getBookById);
router.get('/:id/families', getBookFamilies);
router.post('/', requireAuth, createBook);
router.put('/:id', requireAuth, updateBook);
router.delete('/:id', requireAuth, deleteBook);

// Review routes
router.get('/:bookId/reviews', getBookReviews);
router.post('/:bookId/reviews', createBookReview);

// Like routes
router.get('/:bookId/likes', getBookLikes);
router.post('/:bookId/likes', toggleBookLike);

export default router;
