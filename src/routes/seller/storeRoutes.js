////routes/seller/storeRoutes.js
import express from "express";
import {
  createOrUpdateStore,
  updateStoreById,
  deleteStoreById,
} from "../../controllers/storeController.js";
import { authenticateJWT } from "../../middleware/authMiddleware.js";
import supabase from "../../config/db.js";

const router = express.Router();

// ========================== SELLER STORE ROUTES (AUTHENTICATED ONLY) ==========================

// 🟢 Create or update store
router.post("/", authenticateJWT, createOrUpdateStore);

// 🟡 Update store by store ID
router.put("/:id", authenticateJWT, updateStoreById);

// 🔴 Delete store by store ID
router.delete("/:id", authenticateJWT, deleteStoreById);

// 🟣 Get store by user ID (used when dashboard fetches a seller’s store)
router.get("/user/:userId", authenticateJWT, async (req, res) => {
  const { userId } = req.params;
  try {
    const { data: store, error } = await supabase
      .from("stores")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    if (!store) {
      return res.status(404).json({ message: "Store not found for this user" });
    }

    res.json(store);
  } catch (error) {
    console.error("Error fetching store by userId:", error);
    res.status(500).json({ message: "Server error fetching store" });
  }
});

// 🔵 Get logged-in seller’s store directly from JWT
router.get("/my-store", authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id; // from JWT middleware

    const { data: store, error } = await supabase
      .from("stores")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    if (!store) {
      return res.status(404).json({ message: "Store not found for logged-in user" });
    }

    res.json(store);
  } catch (error) {
    console.error("Error fetching store for logged-in user:", error);
    res.status(500).json({ message: "Server error fetching store" });
  }
});

export default router;

