//routes/buyer/routes
import express from "express";
import {
  getAllStores,
  getStoreById,
  searchStores,
  getProductsByStore, // make sure this exists in your controller
} from "../../controllers/storeController.js";

const router = express.Router();

// ============================= PUBLIC STORE ROUTES =============================

// Get ALL stores (public)
router.get("/", getAllStores);

// Search stores (public)
router.get("/search", searchStores);

// Get products of a store (public)  <-- must come BEFORE getStoreById
router.get("/:storeId/products", getProductsByStore);

// Get store by ID (public)
router.get("/:storeId", getStoreById);

export default router;

