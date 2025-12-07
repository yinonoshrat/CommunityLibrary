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

// Bulk upload routes (async detection with polling)
router.post('/detect-from-image', requireAuth, upload.single('image'), detectBooksFromImage);
router.get('/detect-job/:jobId', requireAuth, getDetectionJob);
router.post('/bulk-add', requireAuth, bulkAddBooks);

export default router;
