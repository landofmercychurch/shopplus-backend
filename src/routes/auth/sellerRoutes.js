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
// SELLER AUTH ROUTES
// ============================================================

// Force role = seller for all routes
router.post('/register', async (req, res) => {
  try {
    req.body.role = 'seller';
    if (!req.body.store_name) {
      return res.status(400).json({ success: false, message: 'Store name is required for sellers.' });
    }
    return registerUser(req, res);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error', details: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const response = await loginUser(req, res, 'seller'); // optional: pass role to enforce
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