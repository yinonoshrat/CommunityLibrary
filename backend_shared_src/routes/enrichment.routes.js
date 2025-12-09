import express from 'express';
import { enrichCatalog } from '../controllers/enrichment.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

// POST /api/enrichment/catalog - Enrich catalog with missing genre and age_range
router.post('/catalog', requireAuth, enrichCatalog);

export default router;
