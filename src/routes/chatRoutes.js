// src/routes/chatRoutes.js
import express from "express";
import {
  sendMessage,
  getSellerInbox,
  getBuyerInbox,
  getConversation,
  markMessagesRead,
  getBuyerUnreadCount,
  getSellerUnreadCount,
} from "../controllers/chatController.js";
import {
  authenticateJWT,
  authenticateJWTWithCookie,
  authorizeRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Helper: try buyer auth first, then seller auth
// Usage: router.post("/send", authAny, handler)
const authAny = async (req, res, next) => {
  // Try buyer cookie (accessToken)
  try {
    await new Promise((resolve, reject) => {
      authenticateJWT(req, res, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    // buyer auth succeeded
    return next();
  } catch (buyerErr) {
    // try seller cookie
    try {
      const sellerAuth = authenticateJWTWithCookie("sellerAccessToken");
      await new Promise((resolve, reject) => {
        sellerAuth(req, res, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
      return next();
    } catch (sellerErr) {
      // both failed — respond with unauthorized (mirror auth middleware behavior)
      console.warn("[authAny] Both buyer and seller auth failed");
      return res.status(401).json({ success: false, error: "Unauthorized: No token provided." });
    }
  }
};

// Strict role guards
const sellerOnly = [authenticateJWTWithCookie("sellerAccessToken"), authorizeRoles("seller")];
const buyerOnly = [authenticateJWT, authorizeRoles("buyer")];

// ------------------------
// UNIVERSAL ROUTES (accept buyer OR seller)
// ------------------------

// Send a new message (buyer or seller)
router.post("/send", authAny, sendMessage);

// Get conversation for a specific store & buyer
router.get("/conversation/:storeId", authAny, getConversation);

// Mark messages as read
router.post("/mark-read", authAny, markMessagesRead);

// ------------------------
// SELLER-SPECIFIC ROUTES
// ------------------------

// Get inbox for seller (all buyers per store)
router.get("/seller/inbox", sellerOnly, getSellerInbox);

// Get unread message count for seller per store
router.get("/seller/unread-count", sellerOnly, getSellerUnreadCount);

// ------------------------
// BUYER-SPECIFIC ROUTES
// ------------------------

// Get inbox for buyer (all stores the buyer messaged)
router.get("/buyer/inbox", buyerOnly, getBuyerInbox);

// Get unread message count for authenticated buyer
router.get("/buyer/unread-count", buyerOnly, getBuyerUnreadCount);

export default router;

