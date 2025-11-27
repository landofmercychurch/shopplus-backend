// routes/auth/sellerRoutes.js
import express from 'express';
import { authenticateJWT } from '../../middleware/authMiddleware.js';
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

// 1️⃣ Register a new seller
router.post('/register', registerSeller);

// 2️⃣ Login seller
router.post('/login', loginSeller);

// 3️⃣ Social login/signup (Gmail, Apple, Facebook)
router.post('/social-login', socialLoginSeller);

// 4️⃣ Refresh access token
router.post('/refresh', refreshAccessToken);

// 5️⃣ Logout
router.post('/logout', logoutUser);

// ============================================================
// USER PROFILE ROUTES (Protected)
// ============================================================

// 6️⃣ Get seller profile
router.get('/profile', authenticateJWT, getUserProfile);

// 7️⃣ Update seller profile
router.put('/profile', authenticateJWT, updateUserProfile);

export default router;