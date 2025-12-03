import express from 'express';
import * as searchController from '../controllers/search.controller.js';
import { extractUserFromToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply token extraction (optional auth)
router.use(extractUserFromToken);

// Global book search (catalog + external sources)
router.get('/search-books', searchController.searchBooksGlobal);

export default router;
