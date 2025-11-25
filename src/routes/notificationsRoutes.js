// src/routes/notificationsRoutes.js
import express from "express";
import {
  createNotificationController,
  getNotificationsController,
  getUnreadCountController,
  markAsReadController,
  markAllAsReadController,
} from "../controllers/notificationsController.js";

import { authenticateJWT, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Only admin/system can create notifications
router.post("/", authenticateJWT, authorizeRoles("admin"), createNotificationController);

// Get notifications for logged-in user
router.get("/", authenticateJWT, getNotificationsController);

// Get unread count
router.get("/unread-count", authenticateJWT, getUnreadCountController);

// Mark one notification as read
router.put("/read/:id", authenticateJWT, markAsReadController);

// Mark all as read
router.put("/read-all", authenticateJWT, markAllAsReadController);

export default router;

