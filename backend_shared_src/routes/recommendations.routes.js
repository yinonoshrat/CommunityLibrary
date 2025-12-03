import express from 'express';
import * as recommendationsController from '../controllers/recommendations.controller.js';
import { extractUserFromToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply token extraction to all routes
router.use(extractUserFromToken);

// Public route - recommendations don't require auth but use userId from query
router.get('/', recommendationsController.getRecommendations);

export default router;
