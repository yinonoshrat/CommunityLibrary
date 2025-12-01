import express from 'express';
import { updateReview, deleteReview } from '../controllers/books.controller.js';

const router = express.Router();

// Review maintenance routes
router.put('/:id', updateReview);
router.delete('/:id', deleteReview);

export default router;
