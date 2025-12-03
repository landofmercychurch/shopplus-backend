// routes/seller.js
import express from 'express';
import { authenticateJWTWithCookie } from '../../middleware/authMiddleware.js';
import { 
  registerSeller,
  loginSeller,
  getUserProfile,
  updateUserProfile,
  refreshAccessToken,
  logoutUser
} from '../../controllers/seller/authController.js';
import { socialLoginSeller } from '../../controllers/seller/socialSellerAuthController.js';

const router = express.Router();

// ============================================================
// SELLER AUTHENTICATION ROUTES
// ============================================================

// Register a new seller
router.post('/register', registerSeller);

// Login seller (sets HttpOnly cookies)
router.post('/login', loginSeller);

// Social login (optional)
router.post('/social-login', socialLoginSeller);

// Refresh access token using seller refresh token
router.post('/refresh', refreshAccessToken);

// Logout seller (clears cookies)
router.post('/logout', authenticateJWTWithCookie('sellerAccessToken'), logoutUser);

// ============================================================
// USER PROFILE ROUTES (Protected)
// ============================================================

// Get current logged-in seller info
router.get('/me', authenticateJWTWithCookie('sellerAccessToken'), getUserProfile);

// Get full seller profile
router.get('/profile', authenticateJWTWithCookie('sellerAccessToken'), getUserProfile);

// Update seller profile
router.put('/profile', authenticateJWTWithCookie('sellerAccessToken'), updateUserProfile);

export default router;

