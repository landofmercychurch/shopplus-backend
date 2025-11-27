// routes/auth/buyerRoutes.js
import express from 'express';
import { authenticateJWT } from '../../middleware/authMiddleware.js';
import { 
  registerUser as registerBuyer,
  loginUser as loginBuyer,
  getUserProfile,
  updateUserProfile,
  refreshAccessToken,
  logoutUser
} from '../../controllers/buyer/authController.js';
import { socialLoginBuyer } from '../../controllers/buyer/socialBuyerAuthController.js';

const router = express.Router();

// ============================================================
// BUYER AUTHENTICATION ROUTES
// ============================================================

// 1️⃣ Register a new buyer
router.post('/register', (req, res) => registerBuyer(req, res, 'buyer'));

// 2️⃣ Login buyer
router.post('/login', (req, res) => loginBuyer(req, res, 'buyer'));

// 3️⃣ Social login/signup (Gmail, Apple, Facebook)
router.post('/social-login', socialLoginBuyer);

// 4️⃣ Refresh access token
router.post('/refresh', refreshAccessToken);

// 5️⃣ Logout
router.post('/logout', logoutUser);

// ============================================================
// USER PROFILE ROUTES (Protected)
// ============================================================

// 6️⃣ Get buyer profile
router.get('/profile', authenticateJWT, getUserProfile);

// 7️⃣ Update buyer profile
router.put('/profile', authenticateJWT, updateUserProfile);

export default router;