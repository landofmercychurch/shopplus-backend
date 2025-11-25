// controllers/followerController.js
import { supabase } from "../config/db.js";

// -------------------- FOLLOW A STORE --------------------
export const followStore = async (req, res) => {
  const userId = req.user.id;
  const { storeId } = req.body;

  try {
    // 1️⃣ Check if already following
    const { data: existing, error: checkError } = await supabase
      .from("store_followers")
      .select("*")
      .eq("store_id", storeId)
      .eq("user_id", userId)
      .single();

    if (checkError && checkError.code !== "PGRST116") throw checkError; // Ignore "No rows found"
    if (existing) {
      // Already following — just return current count
      const { count } = await supabase
        .from("store_followers")
        .select("*", { count: "exact" })
        .eq("store_id", storeId);

      return res.json({ message: "Already following", followersCount: count });
    }

    // 2️⃣ Insert new follower
    const { error: insertError } = await supabase
      .from("store_followers")
      .insert([{ store_id: storeId, user_id: userId }]);

    if (insertError) throw insertError;

    // 3️⃣ Return updated count
    const { count } = await supabase
      .from("store_followers")
      .select("*", { count: "exact" })
      .eq("store_id", storeId);

    res.status(201).json({ message: "Followed successfully", followersCount: count });
  } catch (err) {
    console.error("❌ Follow store error:", err);
    res.status(400).json({ error: err.message });
  }
};

// -------------------- UNFOLLOW A STORE --------------------
export const unfollowStore = async (req, res) => {
  const userId = req.user.id;
  const { storeId } = req.body;

  try {
    await supabase
      .from("store_followers")
      .delete()
      .eq("store_id", storeId)
      .eq("user_id", userId);

    // Return updated count after unfollow
    const { count } = await supabase
      .from("store_followers")
      .select("*", { count: "exact" })
      .eq("store_id", storeId);

    res.json({ message: "Unfollowed successfully", followersCount: count });
  } catch (err) {
    console.error("❌ Unfollow store error:", err);
    res.status(400).json({ error: err.message });
  }
};

// -------------------- GET FOLLOWERS COUNT (PUBLIC) --------------------
export const getStoreFollowersCount = async (req, res) => {
  const { storeId } = req.params;

  try {
    const { count, error } = await supabase
      .from("store_followers")
      .select("*", { count: "exact", head: true })
      .eq("store_id", storeId);

    if (error) throw error;

    res.json({ followersCount: count || 0 });
  } catch (err) {
    console.error("❌ Get followers count error:", err);
    res.status(400).json({ error: err.message });
  }
};

