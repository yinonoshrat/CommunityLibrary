import express from 'express';
import * as loansController from '../controllers/loans.controller.js';
import { extractUserFromToken, requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply token extraction to all routes
router.use(extractUserFromToken);

// Public routes
router.get('/', loansController.getAllLoans);
router.get('/:id', loansController.getLoanById);

// Protected routes
router.post('/', requireAuth, loansController.createLoan);
router.put('/:id', requireAuth, loansController.updateLoan);

export default router;
