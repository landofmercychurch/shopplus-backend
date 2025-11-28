// src/routes/chatRoutes.js
import express from "express";
import {
  sendMessage,
  getBuyerInbox,
  getUserInbox,
  getConversation,
  markMessagesRead,
  getBuyerUnreadCount,
  getSellerUnreadCount,
} from "../controllers/chatController.js";
import { authenticateJWT } from "../middleware/authMiddleware.js";

const router = express.Router();

// ------------------------
// Chat routes
// ------------------------

// Send a new message (buyer or seller)
router.post("/send", authenticateJWT, sendMessage);

// Get inbox for seller (all buyers per store)
router.get("/seller/inbox", authenticateJWT, getBuyerInbox);

// Get inbox for buyer (all stores the buyer messaged)
router.get("/buyer/inbox", authenticateJWT, getUserInbox);

// Get conversation for a specific store & buyer
router.get("/conversation/:storeId", authenticateJWT, getConversation);

// Mark messages as read (buyer -> seller)
router.post("/mark-read", authenticateJWT, markMessagesRead);

// Get unread message count for authenticated buyer
router.get("/buyer/unread-count", authenticateJWT, getBuyerUnreadCount);

// Get unread message count for seller per store
router.get("/seller/unread-count", authenticateJWT, getSellerUnreadCount);

export default router;

