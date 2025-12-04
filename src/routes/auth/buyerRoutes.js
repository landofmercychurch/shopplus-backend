import { supabase } from '../../config/db.js';
import express from 'express';
import { authenticateJWT } from '../../middleware/authMiddleware.js';
import { verifyCSRF, verifyCSRFForAuth } from '../../middleware/csrf.js'; // ⭐ ADD THIS
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
// ⭐ ADD CSRF VERIFICATION to state-changing routes
router.post('/register', verifyCSRFForAuth, registerBuyer);
router.post('/login', verifyCSRFForAuth, loginBuyer);
router.post('/social-login', verifyCSRFForAuth, socialLoginBuyer);
router.post('/logout', authenticateJWT, verifyCSRF, logoutUser); // ⭐ ADD verifyCSRF
router.post('/refresh', verifyCSRF, refreshAccessToken); // ⭐ ADD verifyCSRF

// ============================================================
// USER PROFILE ROUTES (Protected)
// ============================================================
// ⭐ GET routes typically don't need CSRF
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

// ⭐ PUT route needs CSRF
router.get('/profile', authenticateJWT, getUserProfile);
router.put('/profile', authenticateJWT, verifyCSRF, updateUserProfile); // ⭐ ADD verifyCSRF

// ⭐ ADD CSRF token endpoint specific to buyer
router.get('/csrf-token', (req, res) => {
  const token = req.cookies['X-CSRF-TOKEN'] || 'not-set';
  res.json({
    success: true,
    csrfToken: token,
    timestamp: new Date().toISOString()
  });
});

export default router;