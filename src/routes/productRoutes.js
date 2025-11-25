import express from "express";
import {
  getAllProducts,
  getProduct,
  getProductsByStore,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";
import { authenticateJWT, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// -------------------- PUBLIC ROUTES --------------------

// Get all products
router.get("/", getAllProducts);

// Get single product by ID
router.get("/:id", getProduct);

// Get products by store
router.get("/store/:storeId", getProductsByStore);

// -------------------- SELLER / ADMIN ROUTES --------------------

// Create product (requires seller/admin)
router.post("/", authenticateJWT, authorizeRoles("seller", "admin"), createProduct);

// Update product (requires seller/admin)
router.put("/:id", authenticateJWT, authorizeRoles("seller", "admin"), updateProduct);

// Delete product (requires seller/admin)
router.delete("/:id", authenticateJWT, authorizeRoles("seller", "admin"), deleteProduct);

export default router;

