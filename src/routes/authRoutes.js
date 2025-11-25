// routes/authRoutes.js
import express from 'express';
import { 
  registerUser, 
  loginUser, 
  getUserProfile, 
  updateUserProfile, 
  refreshAccessToken, 
  logoutUser 
} from '../controllers/authController.js';
import { authenticateJWT } from '../middleware/authMiddleware.js';

const router = express.Router();

// ============================================================
// AUTHENTICATION ROUTES
// ============================================================

// 1️⃣ Register a new user (no JWT required)
router.post('/register', registerUser);

// 2️⃣ Login user (no JWT required)
// Returns access token in response
// Sets HttpOnly refresh token cookie
router.post('/login', loginUser);

// 3️⃣ Refresh access token (no JWT required)
// Uses HttpOnly refresh token cookie
router.post('/refresh', refreshAccessToken);

// 4️⃣ Logout user (no JWT required)
// Clears HttpOnly refresh token cookie
router.post('/logout', logoutUser);

// ============================================================
// USER PROFILE ROUTES (Protected)
// ============================================================

// 5️⃣ Get current user profile
// Requires valid access token (JWT)
router.get('/profile', authenticateJWT, getUserProfile);

// 6️⃣ Update current user profile
// Requires valid access token (JWT)
router.put('/profile', authenticateJWT, updateUserProfile);

export default router;

