// src/controllers/chatController.js
import { supabase } from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";

// ===============================
// SEND MESSAGE
// ===============================
export const sendMessage = async (req, res) => {
  try {
    const {
      storeId,
      sender,
      targetUserId,
      message,
      message_type: customMessageType,
      reply_to,
      order_id,
      system_event,
    } = req.body;

    if (!storeId || !sender || (!message && !req.file && !system_event)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let file_url = null;
    let file_type = null;
    let message_type = customMessageType || "text";

    // -------------------- Handle File Upload --------------------
    if (req.file) {
      try {
        if (!req.user || !req.user.id) throw new Error("Missing user for file upload");

        const isVideo = req.file.mimetype.startsWith("video/");
        const isDocument = req.file.mimetype.startsWith("application/");
        const folder = isVideo
          ? `chat_video/${req.user.id}`
          : isDocument
          ? `chat_docs/${req.user.id}`
          : `chat_image/${req.user.id}`;

        const result = await cloudinary.uploader.upload(req.file.path, {
          resource_type: isVideo ? "video" : "image",
          folder,
        });

        file_url = result.secure_url;
        file_type = isVideo ? "video" : isDocument ? "document" : "image";

        // Ensure frontend message type matches database
        message_type = isVideo ? "video" : isDocument ? "document" : "image";

        // Remove temp file
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Failed to delete temp file:", err);
        });

        console.log(`File uploaded successfully: ${req.file.originalname} -> ${file_url}`);
      } catch (err) {
        console.error("❌ Cloudinary upload failed:", err);
        return res.status(500).json({ error: "File upload failed" });
      }
    }

    // -------------------- Insert Chat --------------------
    const id = uuidv4();
    const timestamp = new Date();
    const userId = sender === "buyer" ? req.user.id : targetUserId;

    const { error } = await supabase.from("store_chats").insert({
      id,
      store_id: storeId,
      user_id: userId,
      sender,
      message: message || "",
      message_type,
      reply_to: reply_to || null,
      order_id: order_id || null,
      file_url,
      file_type,
      system_event: system_event || null,
      is_read: sender === "seller",
      created_at: timestamp,
      edited_at: null,
    });

    if (error) throw error;

    // -------------------- Emit Real-Time Event --------------------
    const io = req.app.get("io");
    if (io) {
      const room =
        sender === "buyer" ? `store_${storeId}_seller` : `store_${storeId}_buyer_${userId}`;

      io.to(room).emit("receive_message", {
        id,
        store_id: storeId,
        user_id: userId,
        sender,
        message: message || "",
        message_type,
        reply_to: reply_to || null,
        order_id: order_id || null,
        file_url,
        file_type,
        system_event: system_event || null,
        is_read: sender === "seller",
        created_at: timestamp,
        edited_at: null,
      });
    }

    res.status(201).json({
      message: {
        id,
        store_id: storeId,
        user_id: userId,
        sender,
        message: message || "",
        message_type,
        reply_to: reply_to || null,
        order_id: order_id || null,
        file_url,
        file_type,
        system_event: system_event || null,
        is_read: sender === "seller",
        created_at: timestamp,
        edited_at: null,
      },
    });
  } catch (err) {
    console.error("❌ sendMessage error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
};

// ===============================
// GET SELLER INBOX
// ===============================
export const getBuyerInbox = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { data: stores, error: storesError } = await supabase
      .from("stores")
      .select("id")
      .eq("user_id", sellerId);

    if (storesError) throw storesError;
    if (!stores.length) return res.json([]);

    const storeIds = stores.map((s) => s.id);
    const { data: chats, error: chatsError } = await supabase
      .from("store_chats")
      .select(`
        id,
        store_id,
        user_id,
        sender,
        message,
        message_type,
        reply_to,
        order_id,
        file_url,
        file_type,
        system_event,
        is_read,
        created_at,
        edited_at,
        user_profiles!inner(full_name)
      `)
      .in("store_id", storeIds)
      .order("created_at", { ascending: false });

    if (chatsError) throw chatsError;

    const inboxMap = {};
    for (const chat of chats) {
      const key = `${chat.store_id}-${chat.user_id}`;
      if (!inboxMap[key]) {
        inboxMap[key] = {
          buyer_id: chat.user_id,
          buyer_name: chat.user_profiles?.full_name || "",
          store_id: chat.store_id,
          last_message: chat.message,
          last_message_time: chat.created_at,
          unread_count: 0,
          last_message_type: chat.message_type,
          last_file_url: chat.file_url,
          last_file_type: chat.file_type,
          last_system_event: chat.system_event,
        };
      }
      if (!chat.is_read && chat.sender === "buyer") inboxMap[key].unread_count += 1;
    }

    res.json(Object.values(inboxMap));
  } catch (err) {
    console.error("❌ getBuyerInbox error:", err);
    res.status(500).json({ error: "Failed to fetch seller inbox" });
  }
};

// ===============================
// GET BUYER INBOX
// ===============================
export const getUserInbox = async (req, res) => {
  try {
    const buyerId = req.user.id;
    const { data, error } = await supabase
      .from("store_chats")
      .select(`
        id,
        store_id,
        user_id,
        sender,
        message,
        message_type,
        reply_to,
        order_id,
        file_url,
        file_type,
        system_event,
        is_read,
        created_at,
        edited_at,
        stores(name, logo_url)
      `)
      .eq("user_id", buyerId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const inbox = data.reduce((acc, chat) => {
      const key = chat.store_id;
      if (!acc[key])
        acc[key] = {
          store_id: chat.store_id,
          store_name: chat.stores?.name || "",
          store_logo: chat.stores?.logo_url || "",
          last_message: chat.message,
          last_message_time: chat.created_at,
          unread_count: 0,
          last_message_type: chat.message_type,
          last_file_url: chat.file_url,
          last_file_type: chat.file_type,
          last_system_event: chat.system_event,
        };
      if (!chat.is_read && chat.sender === "seller") acc[key].unread_count += 1;
      return acc;
    }, {});

    res.json(Object.values(inbox));
  } catch (err) {
    console.error("❌ getUserInbox error:", err);
    res.status(500).json({ error: "Failed to fetch buyer inbox" });
  }
};

// ===============================
// GET CONVERSATION
// ===============================
export const getConversation = async (req, res) => {
  try {
    const { storeId } = req.params;
    const buyerId = req.query.buyerId;
    if (!storeId) return res.status(400).json({ error: "Missing storeId" });
    if (!buyerId && req.user.role === "seller")
      return res.status(400).json({ error: "Missing buyerId for seller" });

    const targetUserId = buyerId || req.user.id;

    const { data, error } = await supabase
      .from("store_chats")
      .select("*")
      .eq("store_id", storeId)
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    if (req.user.role === "seller") {
      const { error: markError } = await supabase
        .from("store_chats")
        .update({ is_read: true })
        .eq("store_id", storeId)
        .eq("user_id", targetUserId)
        .eq("sender", "buyer")
        .eq("is_read", false);

      if (markError) console.error("❌ Failed to mark messages read:", markError);
    }

    res.json(data);
  } catch (err) {
    console.error("❌ getConversation error:", err);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
};

// ===============================
// MARK MESSAGES READ
// ===============================
export const markMessagesRead = async (req, res) => {
  try {
    const buyerId = req.query.buyerId;
    const { storeId } = req.body;
    if (!buyerId || !storeId) return res.status(400).json({ error: "Missing buyerId or storeId" });

    const { error } = await supabase
      .from("store_chats")
      .update({ is_read: true })
      .eq("store_id", storeId)
      .eq("user_id", buyerId)
      .eq("sender", "seller")
      .eq("is_read", false);

    if (error) throw error;

    const io = req.app.get("io");
    if (io) io.to(`store_${storeId}_seller`).emit("messages_read", { storeId, buyerId });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ markMessagesRead error:", err);
    res.status(500).json({ error: "Failed to mark messages read" });
  }
};

// ===============================
// GET UNREAD COUNT
// ===============================
export const getBuyerUnreadCount = async (req, res) => {
  try {
    const buyerId = req.user.id;
    const { data, error } = await supabase
      .from("store_chats")
      .select("id", { count: "exact" })
      .eq("user_id", buyerId)
      .eq("sender", "seller")
      .eq("is_read", false);

    if (error) throw error;
    res.json({ count: data.length });
  } catch (err) {
    console.error("❌ getBuyerUnreadCount error:", err);
    res.status(500).json({ error: "Failed to get unread count for buyer" });
  }
};

// ===============================
// GET UNREAD COUNT PER BUYER (SELLER)
// ===============================
export const getSellerUnreadCount = async (req, res) => {
  try {
    const { storeId } = req.query;
    if (!storeId) return res.status(400).json({ error: "Missing storeId" });

    const { data, error } = await supabase
      .from("store_chats")
      .select("user_id", { count: "exact", head: false })
      .eq("store_id", storeId)
      .eq("sender", "buyer")
      .eq("is_read", false)
      .group("user_id");

    if (error) throw error;

    const unreadCounts = {};
    data.forEach((row) => {
      unreadCounts[row.user_id] = parseInt(row.count, 10);
    });

    res.json({ unreadCounts });
  } catch (err) {
    console.error("❌ getSellerUnreadCount error:", err);
    res.status(500).json({ error: "Failed to get unread count for seller" });
  }
};

