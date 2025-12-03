// src/routes/notificationsRoutes.js
import express from "express";
import {
  createNotificationController,
  getNotificationsController,
  getUnreadCountController,
  markAsReadController,
  markAllAsReadController,
  // Seller-specific controllers
  getSellerNotificationsController,
  getSellerUnreadCountController,
  markSellerAsReadController,
  markAllSellerAsReadController,
} from "../controllers/notificationsController.js";

import { 
  authenticateJWT, 
  authenticateJWTWithCookie, 
  authorizeRoles 
} from "../middleware/authMiddleware.js";

const router = express.Router();

// ----------------------------
// CREATE NOTIFICATION (Admin only)
// ----------------------------
router.post("/", authenticateJWT, authorizeRoles("admin"), createNotificationController);

// ----------------------------
// BUYER ROUTES (using accessToken cookie)
// ----------------------------

// Get notifications for logged-in user (BUYERS)
router.get("/", authenticateJWT, getNotificationsController);

// Get unread count (BUYERS)
router.get("/unread-count", authenticateJWT, getUnreadCountController);

// Mark one notification as read (BUYERS)
router.put("/read/:id", authenticateJWT, markAsReadController);

// Mark all as read (BUYERS)
router.put("/read-all", authenticateJWT, markAllAsReadController);

// ----------------------------
// SELLER ROUTES (using sellerAccessToken cookie)
// ----------------------------

// Create seller-specific middleware
const sellerAuth = authenticateJWTWithCookie('sellerAccessToken');
const sellerOnly = [sellerAuth, authorizeRoles('seller')];

// Get notifications for logged-in SELLER
router.get("/seller", sellerOnly, getSellerNotificationsController);

// Get seller unread count
router.get("/seller/unread-count", sellerOnly, getSellerUnreadCountController);

// Mark seller notification as read
router.put("/seller/read/:id", sellerOnly, markSellerAsReadController);

// Mark all seller notifications as read
router.put("/seller/read-all", sellerOnly, markAllSellerAsReadController);

// ----------------------------
// SMART ROUTE (auto-detects user type)
// ----------------------------

// Smart notifications endpoint (auto-detects buyer/seller)
router.get("/smart", (req, res, next) => {
  // Check cookies directly
  const cookies = req.cookies || {};
  
  console.log('🍪 [Smart Route] Available cookies:', Object.keys(cookies));
  console.log('🍪 [Smart Route] Has sellerAccessToken?', !!cookies.sellerAccessToken);
  console.log('🍪 [Smart Route] Has accessToken?', !!cookies.accessToken);
  
  // If seller cookie exists, use seller auth
  if (cookies.sellerAccessToken) {
    console.log('🛍️ [Smart Route] Using seller authentication');
    return sellerAuth(req, res, (err) => {
      if (err) return next(err);
      authorizeRoles('seller')(req, res, () => getSellerNotificationsController(req, res));
    });
  }
  
  // Otherwise use buyer auth
  console.log('🛒 [Smart Route] Using buyer authentication');
  return authenticateJWT(req, res, next);
}, getNotificationsController);

// ----------------------------
// UNIVERSAL PARAMETER-BASED ROUTE
// ----------------------------

// Universal route with user_role parameter (matches DB column name)
router.get("/universal", authenticateJWT, (req, res) => {
  const userRole = req.query.user_role || req.user.role || 'buyer';
  
  console.log(`🌐 [Universal] Requested user_role: ${userRole}`);
  
  if (userRole === 'seller') {
    // Verify user is actually a seller
    if (req.user.role !== 'seller') {
      return res.status(403).json({ 
        error: "Unauthorized: Not a seller account" 
      });
    }
    return getSellerNotificationsController(req, res);
  } else {
    return getNotificationsController(req, res);
  }
});

export default router;
