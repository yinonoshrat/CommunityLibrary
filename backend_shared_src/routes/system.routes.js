import express from 'express';
import * as systemController from '../controllers/system.controller.js';

const router = express.Router();

// Health check - no auth required
router.get('/health', systemController.healthCheck);

export default router;
