import { supabase } from '../../config/db.js'; // add this at the top

import express from 'express';
import { authenticateJWT } from '../../middleware/authMiddleware.js';
import { 
  registerBuyer,
  loginBuyer,
  getUserProfile,
  updateUserProfile,
  logoutUser,
  refreshAccessToken
} from '../../controllers/buyer/authController.js';
import { socialLoginBuyer } from '../../controllers/buyer/socialBuyerAuthController.js';

const router = express.Router();

// ============================================================
// BUYER AUTHENTICATION ROUTES
// ============================================================
router.post('/register', registerBuyer);
router.post('/login', loginBuyer);
router.post('/social-login', socialLoginBuyer);
router.post('/logout', authenticateJWT, logoutUser);
router.post('/refresh', refreshAccessToken);

// ============================================================
// USER PROFILE ROUTES (Protected)
// ============================================================
router.get('/me', authenticateJWT, async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error || !profile) {
      return res.status(404).json({ success: false, message: 'Profile not found', details: error });
    }

    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile', details: err.message });
  }
});

router.get('/profile', authenticateJWT, getUserProfile);
router.put('/profile', authenticateJWT, updateUserProfile);

export default router;

