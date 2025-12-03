// routes/seller/storeRoutes.js
import express from "express";
import {
  createOrUpdateStore,
  updateStoreById,
  deleteStoreById,
} from "../../controllers/storeController.js";
import { authenticateJWTWithCookie } from "../../middleware/authMiddleware.js";
import { supabase } from "../../config/db.js";

const router = express.Router();

// ========================== SELLER AUTH MIDDLEWARE ==========================
const authenticateSeller = authenticateJWTWithCookie("sellerAccessToken");

// ========================== SELLER STORE ROUTES ==========================

// 🟢 Create or update store
router.post("/", authenticateSeller, createOrUpdateStore);

// 🟡 Update store by store ID
router.put("/:id", authenticateSeller, updateStoreById);

// 🔴 Delete store by store ID
router.delete("/:id", authenticateSeller, deleteStoreById);

// 🟣 Get store by user ID (used when dashboard fetches a seller’s store)
router.get("/user/:userId", authenticateSeller, async (req, res) => {
  const { userId } = req.params;

  try {
    const { data: store, error } = await supabase
      .from("stores")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    if (!store) return res.status(404).json({ message: "Store not found for this user" });

    res.status(200).json(store);
  } catch (err) {
    console.error("❌ Error fetching store by userId:", err);
    res.status(500).json({ message: "Server error fetching store" });
  }
});

// 🔵 Get logged-in seller’s store directly from JWT
router.get("/my-store", authenticateSeller, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: store, error } = await supabase
      .from("stores")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    if (!store) return res.status(404).json({ message: "Store not found for logged-in user" });

    res.status(200).json(store);
  } catch (err) {
    console.error("❌ Error fetching store for logged-in user:", err);
    res.status(500).json({ message: "Server error fetching store" });
  }
});

export default router;

