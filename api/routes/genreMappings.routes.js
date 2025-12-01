import express from 'express';
import * as genreMappingsController from '../controllers/genreMappings.controller.js';
import { extractUserFromToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply token extraction to all routes
router.use(extractUserFromToken);

// Public routes (genre mappings are for AI enrichment, no auth needed)
router.get('/', genreMappingsController.getAllGenreMappings);
router.post('/', genreMappingsController.saveGenreMapping);

export default router;
