import express from 'express';
import * as usersController from '../controllers/users.controller.js';
import { extractUserFromToken, requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply token extraction to all routes
router.use(extractUserFromToken);

// Public routes
router.get('/', usersController.getAllUsers);
router.get('/:id', usersController.getUserById);

// Protected routes
router.put('/:id', requireAuth, usersController.updateUser);
router.delete('/:id', requireAuth, usersController.deleteUser);

export default router;
