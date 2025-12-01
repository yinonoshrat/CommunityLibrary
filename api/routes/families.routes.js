import express from 'express';
import * as familiesController from '../controllers/families.controller.js';
import { extractUserFromToken, requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply token extraction to all routes
router.use(extractUserFromToken);

// Public routes (can view families without auth)
router.get('/', familiesController.getAllFamilies);
router.get('/:id', familiesController.getFamilyById);
router.post('/check-name', familiesController.checkFamilyName);
router.get('/:id/members', familiesController.getFamilyMembers);

// Protected routes
router.post('/', requireAuth, familiesController.createFamily);
router.put('/:id', requireAuth, familiesController.updateFamily);
router.delete('/:id', requireAuth, familiesController.deleteFamily);

export default router;
