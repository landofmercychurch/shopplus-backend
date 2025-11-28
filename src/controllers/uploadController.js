// src/controllers/uploadController.js
import cloudinary from "../config/cloudinary.js";

// ===============================
// Helper: Upload a file to Cloudinary with optional progress
// ===============================
const uploadFileToCloud = (file, folder, isVideo = false, onProgress) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: isVideo ? "video" : "image",
        folder,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    // Optional simulated progress for frontend updates
    if (onProgress && file.buffer) {
      const totalSize = file.buffer.length;
      let uploaded = 0;
      const chunkSize = 64 * 1024; // 64KB
      let offset = 0;

      const interval = setInterval(() => {
        if (offset >= totalSize) {
          clearInterval(interval);
        } else {
          uploaded = Math.min(offset + chunkSize, totalSize);
          offset = uploaded;
          onProgress(Math.round((uploaded / totalSize) * 100));
        }
      }, 50);
    }

    stream.end(file.buffer);
  });
};

// ===============================
// Generic upload handler
// ===============================
const handleUpload = async (req, res, folderFn, options = {}) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: "No files uploaded" });
    }

    if (options.maxFiles && files.length > options.maxFiles) {
      return res
        .status(400)
        .json({ success: false, error: `Maximum ${options.maxFiles} files allowed per upload` });
    }

    const userId = req.user.sub;
    const uploadedFiles = [];

    for (const file of files) {
      const isVideo = file.mimetype.startsWith("video/");
      const isDocument = file.mimetype.startsWith("application/");

      // Check max video size
      if (isVideo && options.maxVideoSize && file.size > options.maxVideoSize) {
        return res
          .status(400)
          .json({ success: false, error: `Video too large. Max ${options.maxVideoSize / 1024 / 1024}MB.` });
      }

      const folder = folderFn(file, userId);
      const result = await uploadFileToCloud(file, folder, isVideo, (percent) => {
        if (req.app.get("io") && req.body.progressId) {
          req.app
            .get("io")
            .emit(`upload_progress_${req.body.progressId}`, { fileName: file.originalname, progress: percent });
        }
      });

      uploadedFiles.push({
        url: result.secure_url,
        type: isVideo ? "video" : isDocument ? "document" : "image",
      });
    }

    res.json({ success: true, files: uploadedFiles });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ success: false, error: "Server error during upload" });
  }
};

// ===============================
// Specific upload endpoints
// ===============================

// Store images (logo/banner)
export const uploadStoreImages = (req, res) =>
  handleUpload(req, res, (file, userId) =>
    file.originalname.toLowerCase().includes("logo") ? `store_logo/${userId}` : `store_banner/${userId}`
  );

// Chat media (images/videos/documents) - max 5 files
export const uploadChatMedia = (req, res) =>
  handleUpload(
    req,
    res,
    (file, userId) => {
      if (file.mimetype.startsWith("video/")) return `chat_video/${userId}`;
      if (file.mimetype.startsWith("application/")) return `chat_docs/${userId}`;
      return `chat_image/${userId}`;
    },
    { maxFiles: 5, maxVideoSize: 10 * 1024 * 1024 }
  );

// Product images - max 5 files
export const uploadProductImages = (req, res) =>
  handleUpload(req, res, (file, userId) => `product_images/${userId}`, { maxFiles: 5 });

// Review images - multiple files allowed
export const uploadReviewImages = (req, res) =>
  handleUpload(req, res, (file, userId) => `review_images/${userId}`);

