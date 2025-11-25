// src/controllers/notificationsController.js
import { supabase } from "../config/db.js";
import DOMPurify from "isomorphic-dompurify";

/**
 * CREATE NOTIFICATION
 * Only admin/system can send notifications
 */
export const createNotificationController = async (req, res) => {
  try {
    const { user_id, type, title, message } = req.body;

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
        },
      ])
      .select()
      .single();

    if (error) throw error;

    const io = req.app.get("io");
    if (io) io.to(String(user_id)).emit("new-notification", data);

    return res.status(201).json({ success: true, notification: data });
  } catch (err) {
    console.error("Create Notification Error:", err);
    return res.status(500).json({ error: "Server error creating notification" });
  }
};

/**
 * GET NOTIFICATIONS WITH PAGINATION + TYPE FILTER
 */
export const getNotificationsController = async (req, res) => {
  try {
    const userId = req.user.id;


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

    if (type) query = query.eq("type", type);

    const { data, count, error } = await query;

    if (error) throw error;

    return res.json({
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
      notifications: data || [],
    });
  } catch (err) {
    console.error("Get Notifications Error:", err);
    return res.status(500).json({ error: "Server error fetching notifications" });
  }
};

/**
 * GET UNREAD COUNT
 */
export const getUnreadCountController = async (req, res) => {
  try {
    const userId = req.user.id;



    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) throw error;

    return res.json({ unread: count || 0 });
  } catch (err) {
    console.error("Unread Count Error:", err);
    return res.status(500).json({ error: "Server error fetching unread count" });
  }
};

/**
 * MARK SINGLE NOTIFICATION AS READ
 */
export const markAsReadController = async (req, res) => {
  try {
    const userId = req.user.id;
 

    const id = parseInt(req.params.id);

    const { error, count } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    if (count === 0) return res.status(404).json({ error: "Notification not found" });

    return res.json({ success: true, id });
  } catch (err) {
    console.error("Mark As Read Error:", err);
    return res.status(500).json({ error: "Server error marking notification" });
  }
};

/**
 * MARK ALL AS READ
 */
export const markAllAsReadController = async (req, res) => {
  try {
    const userId = req.user.id;




    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId);

    if (error) throw error;

    return res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    console.error("Mark All Read Error:", err);
    return res.status(500).json({ error: "Server error marking all notifications" });
  }
};

