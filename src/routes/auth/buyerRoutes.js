import express from 'express';
import { 
  registerUser, 
  loginUser, 
  getUserProfile, 
  updateUserProfile, 
  refreshAccessToken, 
  logoutUser 
} from '../../controllers/authController.js';
import { authenticateJWT } from '../../middleware/authMiddleware.js';

const router = express.Router();

// ============================================================
// BUYER AUTH ROUTES
// ============================================================

// Force role = buyer for all routes
router.post('/register', async (req, res) => {
  try {
    req.body.role = 'buyer';
    // No store required
    return registerUser(req, res);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error', details: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const response = await loginUser(req, res, 'buyer'); // optional: pass role to enforce
    return response;
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error', details: err.message });
  }
});

router.post('/refresh', refreshAccessToken);
router.post('/logout', logoutUser);

// ============================================================
// PROFILE ROUTES (Protected)
// ============================================================
router.get('/profile', authenticateJWT, getUserProfile);
router.put('/profile', authenticateJWT, updateUserProfile);

export default router;