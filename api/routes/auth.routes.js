import express from 'express';
import {
  register,
  getAccountsByEmail,
  login,
  logout,
  completeOAuth,
  getCurrentUser,
} from '../controllers/auth.controller.js';

const router = express.Router();

// Registration & Login
router.post('/register', register);
router.post('/accounts-by-email', getAccountsByEmail);
router.post('/login', login);
router.post('/logout', logout);

// OAuth
router.post('/oauth-complete', completeOAuth);

// Current user
router.get('/me', getCurrentUser);

export default router;
