import express from 'express';
import { authenticateJWTWithCookie } from '../../middleware/authMiddleware.js';
import { verifyCSRF, verifyCSRFForAuth } from '../../middleware/csrf.js'; // ⭐ ADD THIS
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
// ⭐ ADD CSRF VERIFICATION
router.post('/register', verifyCSRFForAuth, registerSeller);
router.post('/login', verifyCSRFForAuth, loginSeller);
router.post('/social-login', verifyCSRFForAuth, socialLoginSeller);
router.post('/refresh', verifyCSRF, refreshAccessToken);
router.post('/logout', authenticateJWTWithCookie('sellerAccessToken'), verifyCSRF, logoutUser);

// ============================================================
// USER PROFILE ROUTES (Protected)
// ============================================================
// ⭐ GET routes don't need CSRF
router.get('/me', authenticateJWTWithCookie('sellerAccessToken'), getUserProfile);
router.get('/profile', authenticateJWTWithCookie('sellerAccessToken'), getUserProfile);

// ⭐ PUT route needs CSRF
router.put('/profile', authenticateJWTWithCookie('sellerAccessToken'), verifyCSRF, updateUserProfile);

// ⭐ ADD CSRF token endpoint for seller
router.get('/csrf-token', (req, res) => {
  const token = req.cookies['X-CSRF-TOKEN'] || 'not-set';
  res.json({
    success: true,
    csrfToken: token,
    timestamp: new Date().toISOString()
  });
});

export default router;