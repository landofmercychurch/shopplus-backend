// src/controllers/notificationsController.js
import { supabase } from "../config/db.js";
import DOMPurify from "isomorphic-dompurify";

// ----------------------------
// HELPER: Get user role from JWT
// ----------------------------
const getUserRoleFromJWT = (user) => {
  return user.role || 'buyer'; // Use the role from JWT
};

// ----------------------------
// COMMON FUNCTIONS
// ----------------------------

/**
 * CREATE NOTIFICATION
 * Only admin/system can send notifications
 */
export const createNotificationController = async (req, res) => {
  try {
    const { user_id, type, title, message, user_role = "buyer" } = req.body;

    if (!user_id || !title || !type) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const cleanTitle = DOMPurify.sanitize(title);
    const cleanMessage = DOMPurify.sanitize(message || "");

    const { data, error } = await supabase
      .from("notifications")
      .insert([
        {
          user_id,
          type,
          title: cleanTitle,
          message: cleanMessage,
          user_role: user_role, // Store user role (buyer/seller) - matches DB column
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Emit to appropriate socket room
    const io = req.app.get("io");
    if (io) {
      if (user_role === 'seller') {
        io.to(`seller_${user_id}`).emit("new-seller-notification", data);
      } else {
        io.to(String(user_id)).emit("new-notification", data);
      }
    }

    return res.status(201).json({ 
      success: true, 
      notification: data,
      user_role: user_role 
    });
  } catch (err) {
    console.error("Create Notification Error:", err);
    return res.status(500).json({ error: "Server error creating notification" });
  }
};

/**
 * GET NOTIFICATIONS WITH PAGINATION + TYPE FILTER
 * For buyers (using accessToken)
 */
export const getNotificationsController = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = getUserRoleFromJWT(req.user);

    console.log(`🔔 [Notifications] Fetching for ${userRole}: ${userId}`);

    const page = parseInt(req.query.page || 1);
    const limit = parseInt(req.query.limit || 20);
    const type = req.query.type || null;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by user_role (buyer notifications only)
    // For buyer routes, only show buyer notifications
    if (userRole === 'buyer') {
      query = query.eq("user_role", "buyer");
    }

    // Optional filter by user_role from query
    if (req.query.user_role) {
      query = query.eq("user_role", req.query.user_role);
    }

    if (type) query = query.eq("type", type);

    const { data, count, error } = await query;

    if (error) throw error;

    return res.json({
      success: true,
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
      notifications: data || [],
      user_role: userRole,
    });
  } catch (err) {
    console.error("Get Notifications Error:", err);
    return res.status(500).json({ error: "Server error fetching notifications" });
  }
};

/**
 * GET UNREAD COUNT
 * For buyers (using accessToken)
 */
export const getUnreadCountController = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = getUserRoleFromJWT(req.user);

    let query = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .eq("is_read", false)
      .eq("user_role", "buyer"); // Only count buyer notifications

    const { count, error } = await query;

    if (error) throw error;

    return res.json({ 
      success: true,
      unread: count || 0,
      user_role: userRole 
    });
  } catch (err) {
    console.error("Unread Count Error:", err);
    return res.status(500).json({ error: "Server error fetching unread count" });
  }
};

/**
 * MARK SINGLE NOTIFICATION AS READ
 * For buyers (using accessToken)
 */
export const markAsReadController = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = getUserRoleFromJWT(req.user);
    const notificationId = req.params.id;

    let query = supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("user_id", userId)
      .eq("user_role", "buyer"); // Only mark buyer notifications

    const { error, count } = await query;

    if (error) throw error;
    if (count === 0) {
      return res.status(404).json({ 
        error: "Notification not found or unauthorized" 
      });
    }

    return res.json({ 
      success: true, 
      id: notificationId,
      user_role: userRole 
    });
  } catch (err) {
    console.error("Mark As Read Error:", err);
    return res.status(500).json({ error: "Server error marking notification" });
  }
};

/**
 * MARK ALL AS READ
 * For buyers (using accessToken)
 */
export const markAllAsReadController = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = getUserRoleFromJWT(req.user);

    let query = supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false)
      .eq("user_role", "buyer"); // Only mark buyer notifications

    const { error } = await query;

    if (error) throw error;

    return res.json({ 
      success: true, 
      message: "All buyer notifications marked as read",
      user_role: userRole 
    });
  } catch (err) {
    console.error("Mark All Read Error:", err);
    return res.status(500).json({ error: "Server error marking all notifications" });
  }
};

// ----------------------------
// SELLER-SPECIFIC CONTROLLERS
// ----------------------------

/**
 * GET SELLER NOTIFICATIONS
 * For sellers (using sellerAccessToken)
 */
export const getSellerNotificationsController = async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`🛍️ [Seller Notifications] Fetching for seller: ${userId}`);

    const page = parseInt(req.query.page || 1);
    const limit = parseInt(req.query.limit || 20);
    const type = req.query.type || null;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .eq("user_role", "seller") // CRITICAL: Only seller notifications
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) query = query.eq("type", type);

    const { data, count, error } = await query;

    if (error) throw error;

    console.log(`🛍️ [Seller Notifications] Found ${data?.length || 0} notifications`);

    return res.json({
      success: true,
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
      notifications: data || [],
      user_role: "seller",
    });
  } catch (err) {
    console.error("Get Seller Notifications Error:", err);
    return res.status(500).json({ error: "Server error fetching seller notifications" });
  }
};

/**
 * GET SELLER UNREAD COUNT
 */
export const getSellerUnreadCountController = async (req, res) => {
  try {
    const userId = req.user.id;

    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .eq("user_role", "seller") // Only seller notifications
      .eq("is_read", false);

    if (error) throw error;

    return res.json({ 
      success: true,
      unread: count || 0,
      user_role: "seller" 
    });
  } catch (err) {
    console.error("Seller Unread Count Error:", err);
    return res.status(500).json({ error: "Server error fetching seller unread count" });
  }
};

/**
 * MARK SELLER NOTIFICATION AS READ
 */
export const markSellerAsReadController = async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const { error, count } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("user_id", userId)
      .eq("user_role", "seller"); // CRITICAL: Only seller notifications

    if (error) throw error;
    if (count === 0) {
      return res.status(404).json({ 
        error: "Seller notification not found" 
      });
    }

    return res.json({ 
      success: true, 
      id: notificationId,
      user_role: "seller" 
    });
  } catch (err) {
    console.error("Mark Seller As Read Error:", err);
    return res.status(500).json({ error: "Server error marking seller notification" });
  }
};

/**
 * MARK ALL SELLER NOTIFICATIONS AS READ
 */
export const markAllSellerAsReadController = async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("user_role", "seller") // CRITICAL: Only seller notifications
      .eq("is_read", false);

    if (error) throw error;

    return res.json({ 
      success: true, 
      message: "All seller notifications marked as read",
      user_role: "seller"
    });
  } catch (err) {
    console.error("Mark All Seller Read Error:", err);
    return res.status(500).json({ error: "Server error marking all seller notifications" });
  }
};
