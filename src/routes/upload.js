// src/routes/upload.js
import express from "express";
import multer from "multer";
import { authenticateJWT } from "../middleware/authMiddleware.js";
import {
  uploadStoreImages,
  uploadChatMedia,
  uploadProductImages,
  uploadReviewImages,
} from "../controllers/uploadController.js";

const router = express.Router();

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max per file (videos handled separately)
});

// ----------------------------
// Store uploads
// ----------------------------
router.post(
  "/store",
  authenticateJWT,
  upload.array("files", 5),
  uploadStoreImages
);

// ----------------------------
// Chat uploads
// ----------------------------
router.post(
  "/chat",
  authenticateJWT,
  upload.array("files", 5),
  uploadChatMedia
);

// ----------------------------
// Product uploads
// ----------------------------
router.post(
  "/product",
  authenticateJWT,
  upload.array("files", 5),
  uploadProductImages
);

// ----------------------------
// Review uploads
// ----------------------------
router.post(
  "/review",
  authenticateJWT,
  upload.array("files", 5),
  uploadReviewImages
);

export default router;

