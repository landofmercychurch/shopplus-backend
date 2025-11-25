// routes/followerRoutes.js
import express from "express";
import {
  followStore,
  unfollowStore,
  getStoreFollowersCount
} from "../controllers/followerController.js";
import { authenticateJWT } from "../middleware/authMiddleware.js";

const router = express.Router();

// -------------------- PRIVATE ROUTES --------------------

// Follow a store (requires login)
router.post("/follow", authenticateJWT, followStore);

// Unfollow a store (requires login)
router.post("/unfollow", authenticateJWT, unfollowStore);

// -------------------- PUBLIC ROUTES --------------------

// Get followers count for a store (no auth required)
router.get("/:storeId/count", getStoreFollowersCount);

// Check if current user follows a store (requires login)
router.get("/:storeId/status", authenticateJWT, async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("followers")
      .select("*")
      .eq("store_id", storeId)
      .eq("follower_id", userId)
      .single();

    if (error && error.code !== "PGRST116") throw error; // ignore 'no rows' error

    const isFollowing = !!data;
    res.json({ isFollowing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to check follow status" });
  }
});


export default router;

