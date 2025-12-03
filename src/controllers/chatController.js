// src/controllers/chatController.js
import { supabase } from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";

const ALLOWED_MESSAGE_TYPES = ["text", "image", "document", "video", "system"];

/**
 * Helper: upload file (if present) and determine message/file type
 * Returns { file_url, file_type, message_type } or null values
 */
async function handleFileUpload(file, userId) {
  if (!file) return { file_url: null, file_type: null, message_type: "text" };

  try {
    const mimetype = file.mimetype || "";
    const isVideo = mimetype.startsWith("video/");
    const isDocument = mimetype.startsWith("application/");
    const folder = isVideo
      ? `chat_video/${userId}`
      : isDocument
      ? `chat_docs/${userId}`
      : `chat_image/${userId}`;

    const result = await cloudinary.uploader.upload(file.path, {
      resource_type: isVideo ? "video" : "image",
      folder,
    });

    // Cleanup temp file (best-effort)
    fs.unlink(file.path, (err) => {
      if (err) console.warn("[Chat] Failed to delete temp upload:", err);
    });

    const file_url = result.secure_url;
    const file_type = isVideo ? "video" : isDocument ? "document" : "image";
    const message_type = file_type;

    return { file_url, file_type, message_type };
  } catch (err) {
    console.error("❌ Cloudinary upload failed:", err);
    throw new Error("File upload failed");
  }
}

/**
 * Universal send message endpoint — accepts seller or buyer
 *
 * Rules:
 * - store_chats.user_id is ALWAYS the buyer id
 * - sender === "buyer" -> userId = req.user.id (user must be buyer)
 * - sender === "seller" -> userId = targetUserId (seller must provide buyer id)
 */
export const sendMessage = async (req, res) => {
  try {
    console.log("[Chat] sendMessage called by:", req.user?.id, "role:", req.user?.role);

    // Input normalization (some clients send JSON body with .chat etc)
    const {
      storeId,
      sender,
      targetUserId,
      message,
      message_type: incomingMessageType,
      reply_to,
      order_id,
      system_event,
    } = req.body;

    // Basic validation
    if (!sender || (sender !== "buyer" && sender !== "seller")) {
      return res.status(400).json({ success: false, error: "Invalid sender value" });
    }

    if (!storeId) {
      return res.status(400).json({ success: false, error: "Missing storeId" });
    }

    // If buyer sends, ensure req.user is buyer
    if (sender === "buyer" && req.user.role !== "buyer") {
      return res.status(403).json({ success: false, error: "Unauthorized: Only buyers can send as buyer" });
    }

    // If seller sends, ensure req.user is seller and targetUserId (buyer) is provided
    if (sender === "seller") {
      if (req.user.role !== "seller") {
        return res.status(403).json({ success: false, error: "Unauthorized: Only sellers can send as seller" });
      }
      if (!targetUserId) {
        return res.status(400).json({ success: false, error: "Missing targetUserId (buyer id) for seller" });
      }

      // Verify seller actually owns the store
      const { data: store, error: storeErr } = await supabase
        .from("stores")
        .select("user_id")
        .eq("id", storeId)
        .single();

      if (storeErr) {
        console.error("[Chat] Store lookup error:", storeErr);
        return res.status(500).json({ success: false, error: "Failed to validate store" });
      }
      if (!store || store.user_id !== req.user.id) {
        return res.status(403).json({ success: false, error: "Unauthorized: You don't own this store" });
      }
    }

    // Must have either message, file, or system_event
    if (!message && !req.file && !system_event) {
      return res.status(400).json({ success: false, error: "Missing message or file or system_event" });
    }

    // Determine buyerId (store_chats.user_id)
    const buyerId = sender === "buyer" ? req.user.id : targetUserId;

    // Handle file upload if present
    let file_url = null;
    let file_type = null;
    let message_type = incomingMessageType || "text";

    if (req.file) {
      try {
        const upload = await handleFileUpload(req.file, req.user.id);
        file_url = upload.file_url;
        file_type = upload.file_type;
        message_type = upload.message_type;
      } catch (err) {
        console.error("[Chat] File upload error:", err.message);
        return res.status(500).json({ success: false, error: "File upload failed" });
      }
    } else {
      // Sanitize message_type to allowed list
      if (incomingMessageType && ALLOWED_MESSAGE_TYPES.includes(incomingMessageType)) {
        message_type = incomingMessageType;
      } else if (!message && system_event) {
        message_type = "system";
      } else {
        message_type = "text";
      }
    }

    const id = uuidv4();
    const timestamp = new Date();

    // Insert into DB — note user_id is buyerId per DB FK
    const { error: insertError } = await supabase.from("store_chats").insert({
      id,
      store_id: storeId,
      user_id: buyerId,
      sender,
      message: message || "",
      message_type,
      reply_to: reply_to || null,
      order_id: order_id || null,
      file_url,
      file_type,
      system_event: system_event || null,
      is_read: sender === "seller", // mark read if seller sent (seller messages considered read for seller side)
      created_at: timestamp,
      edited_at: null,
    });

    if (insertError) {
      console.error("[Chat] DB insert error:", insertError);
      return res.status(500).json({ success: false, error: "Failed to save message" });
    }

    // Prepare payload for emit
    const savedChat = {
      id,
      store_id: storeId,
      user_id: buyerId,
      sender,
      message: message || "",
      message_type,
      file_url,
      file_type,
      is_read: sender === "seller",
      created_at: timestamp,
    };

    // Emit via socket if available
    try {
      const io = req.app.get("io");
      if (io) {
        // Emit to seller room
        io.to(`store_${storeId}_seller`).emit("receive_message", savedChat);

        // Emit to the buyer room
        io.to(`store_${storeId}_buyer_${buyerId}`).emit("receive_message", savedChat);
      } else {
        console.warn("[Chat] No io instance on req.app — skipping emits");
      }
    } catch (emitErr) {
      console.error("[Chat] Socket emit error:", emitErr);
    }

    return res.status(201).json({ success: true, message: savedChat });
  } catch (err) {
    console.error("❌ sendMessage error:", err);
    return res.status(500).json({ success: false, error: "Failed to send message" });
  }
};

/**
 * Get seller inbox grouped by buyer per store
 * Expects req.user.role === 'seller'
 */
export const getSellerInbox = async (req, res) => {
  try {
    if (req.user.role !== "seller") {
      return res.status(403).json({ success: false, error: "Unauthorized: Seller endpoint only" });
    }

    console.log("[Chat] getSellerInbox for seller:", req.user.id);

    const sellerId = req.user.id;

    // Get stores owned by seller
    const { data: stores, error: storesError } = await supabase
      .from("stores")
      .select("id, name")
      .eq("user_id", sellerId);

    if (storesError) {
      console.error("[Chat] stores query error:", storesError);
      return res.status(500).json({ success: false, error: "Failed to fetch stores" });
    }

    if (!stores || stores.length === 0) {
      return res.json({ success: true, inbox: [], store_count: 0 });
    }

    const storeIds = stores.map((s) => s.id);

    // Fetch recent chat rows for these stores, include buyer profile
    const { data: chats, error: chatsError } = await supabase
      .from("store_chats")
      .select(`
        id,
        store_id,
        user_id,
        sender,
        message,
        message_type,
        file_url,
        file_type,
        is_read,
        created_at,
        user_profiles!inner(full_name, avatar_url)
      `)
      .in("store_id", storeIds)
      .order("created_at", { ascending: false });

    if (chatsError) {
      console.error("[Chat] chats query error:", chatsError);
      return res.status(500).json({ success: false, error: "Failed to fetch chats" });
    }

    // Group by (store_id, buyer_id)
    const inboxMap = Object.create(null);

    for (const chat of chats || []) {
      const buyerId = chat.user_id;
      const storeId = chat.store_id;
      const key = `${storeId}::${buyerId}`;

      if (!inboxMap[key]) {
        const storeInfo = stores.find((s) => s.id === storeId);
        inboxMap[key] = {
          buyer_id: buyerId,
          buyer_name: chat.user_profiles?.full_name || "Customer",
          buyer_avatar: chat.user_profiles?.avatar_url || null,
          store_id: storeId,
          store_name: storeInfo?.name || "Store",
          last_message: chat.message || (chat.file_url ? "📎 Attachment" : ""),
          last_message_time: chat.created_at,
          last_message_type: chat.message_type,
          last_file_url: chat.file_url,
          last_file_type: chat.file_type,
          unread_count: 0,
        };
      }

      if (!chat.is_read && chat.sender === "buyer") {
        inboxMap[key].unread_count += 1;
      }
    }

    const inbox = Object.values(inboxMap).sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));

    return res.json({ success: true, inbox, store_count: stores.length });
  } catch (err) {
    console.error("❌ getSellerInbox error:", err);
    return res.status(500).json({ success: false, error: "Failed to fetch seller inbox" });
  }
};

/**
 * Get buyer inbox grouped by store
 */
export const getBuyerInbox = async (req, res) => {
  try {
    if (req.user.role !== "buyer") {
      return res.status(403).json({ success: false, error: "Unauthorized: Buyer endpoint only" });
    }

    console.log("[Chat] getBuyerInbox for buyer:", req.user.id);

    const buyerId = req.user.id;

    const { data: chats, error } = await supabase
      .from("store_chats")
      .select(`
        id,
        store_id,
        sender,
        message,
        message_type,
        file_url,
        file_type,
        is_read,
        created_at,
        stores!inner(name, logo_url, user_id)
      `)
      .eq("user_id", buyerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Chat] buyer inbox query error:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch buyer inbox" });
    }

    const inboxMap = Object.create(null);

    for (const chat of chats || []) {
      const storeId = chat.store_id;
      if (!inboxMap[storeId]) {
        inboxMap[storeId] = {
          store_id: storeId,
          store_name: chat.stores?.name || "Store",
          store_logo: chat.stores?.logo_url || null,
          store_owner_id: chat.stores?.user_id || null,
          last_message: chat.message || (chat.file_url ? "📎 Attachment" : ""),
          last_message_time: chat.created_at,
          last_message_type: chat.message_type,
          last_file_url: chat.file_url,
          last_file_type: chat.file_type,
          unread_count: 0,
        };
      }

      if (!chat.is_read && chat.sender === "seller") {
        inboxMap[storeId].unread_count += 1;
      }
    }

    const inbox = Object.values(inboxMap).sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));

    return res.json({ success: true, inbox, total_stores: inbox.length });
  } catch (err) {
    console.error("❌ getBuyerInbox error:", err);
    return res.status(500).json({ success: false, error: "Failed to fetch buyer inbox" });
  }
};

/**
 * Get conversation between buyer and store
 * - If seller requests, buyerId must be provided (query param)
 * - If buyer requests, they can view their own conversation
 */
export const getConversation = async (req, res) => {
  try {
    const { storeId } = req.params;
    const buyerIdQuery = req.query.buyerId;

    console.log("[Chat] getConversation called:", { storeId, buyerIdQuery, userId: req.user.id, role: req.user.role });

    if (!storeId) return res.status(400).json({ success: false, error: "Missing storeId" });

    let targetBuyerId;

    if (req.user.role === "seller") {
      if (!buyerIdQuery) return res.status(400).json({ success: false, error: "Missing buyerId for seller" });

      // Verify seller owns the store
      const { data: store, error: storeErr } = await supabase
        .from("stores")
        .select("user_id")
        .eq("id", storeId)
        .single();

      if (storeErr) {
        console.error("[Chat] store lookup error:", storeErr);
        return res.status(500).json({ success: false, error: "Failed to validate store" });
      }
      if (!store || store.user_id !== req.user.id) {
        return res.status(403).json({ success: false, error: "Unauthorized: You don't own this store" });
      }

      targetBuyerId = buyerIdQuery;
    } else {
      // buyer
      targetBuyerId = req.user.id;
    }

    const { data, error } = await supabase
      .from("store_chats")
      .select("*")
      .eq("store_id", storeId)
      .eq("user_id", targetBuyerId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[Chat] conversation query error:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch conversation" });
    }

    // If seller opened conversation, mark buyer messages as read
    if (req.user.role === "seller") {
      const { error: markError } = await supabase
        .from("store_chats")
        .update({ is_read: true })
        .eq("store_id", storeId)
        .eq("user_id", targetBuyerId)
        .eq("sender", "buyer")
        .eq("is_read", false);

      if (markError) console.error("[Chat] mark read error:", markError);

      // Emit read event to buyer room
      try {
        const io = req.app.get("io");
        if (io) {
          io.to(`store_${storeId}_buyer_${targetBuyerId}`).emit("messages_read", { storeId, buyerId: targetBuyerId });
        }
      } catch (emitErr) {
        console.error("[Chat] emit messages_read error:", emitErr);
      }
    }

    return res.json({ success: true, conversation: data, store_id: storeId, user_id: targetBuyerId });
  } catch (err) {
    console.error("❌ getConversation error:", err);
    return res.status(500).json({ success: false, error: "Failed to fetch conversation" });
  }
};

/**
 * Mark messages read
 * For seller: body must include { storeId }, query buyerId
 * For buyer: body must include { storeId }
 */
export const markMessagesRead = async (req, res) => {
  try {
    const { storeId } = req.body;
    const buyerIdQuery = req.query.buyerId;

    console.log("[Chat] markMessagesRead:", { storeId, buyerIdQuery, userId: req.user.id, role: req.user.role });

    if (!storeId) return res.status(400).json({ success: false, error: "Missing storeId" });

    if (req.user.role === "seller") {
      if (!buyerIdQuery) return res.status(400).json({ success: false, error: "Missing buyerId for seller" });

      // Verify seller owns store
      const { data: store, error: storeErr } = await supabase
        .from("stores")
        .select("user_id")
        .eq("id", storeId)
        .single();

      if (storeErr) {
        console.error("[Chat] store lookup error:", storeErr);
        return res.status(500).json({ success: false, error: "Failed to validate store" });
      }
      if (!store || store.user_id !== req.user.id) {
        return res.status(403).json({ success: false, error: "Unauthorized: You don't own this store" });
      }

      const { error } = await supabase
        .from("store_chats")
        .update({ is_read: true })
        .eq("store_id", storeId)
        .eq("user_id", buyerIdQuery)
        .eq("sender", "buyer")
        .eq("is_read", false);

      if (error) {
        console.error("[Chat] mark read DB error:", error);
        return res.status(500).json({ success: false, error: "Failed to mark read" });
      }

      // Emit to seller room so seller UI updates
      try {
        const io = req.app.get("io");
        if (io) io.to(`store_${storeId}_seller`).emit("messages_read", { storeId, buyerId: buyerIdQuery });
      } catch (emitErr) {
        console.error("[Chat] emit messages_read error:", emitErr);
      }

      return res.json({ success: true });
    } else {
      // Buyer marks seller messages as read
      const { error } = await supabase
        .from("store_chats")
        .update({ is_read: true })
        .eq("store_id", storeId)
        .eq("user_id", req.user.id)
        .eq("sender", "seller")
        .eq("is_read", false);

      if (error) {
        console.error("[Chat] buyer mark read DB error:", error);
        return res.status(500).json({ success: false, error: "Failed to mark read" });
      }

      return res.json({ success: true });
    }
  } catch (err) {
    console.error("❌ markMessagesRead error:", err);
    return res.status(500).json({ success: false, error: "Failed to mark messages read" });
  }
};

/**
 * Buyer unread count
 */
export const getBuyerUnreadCount = async (req, res) => {
  try {
    if (req.user.role !== "buyer") {
      return res.status(403).json({ success: false, error: "Unauthorized: Buyer endpoint only" });
    }

    const buyerId = req.user.id;

    const { count, error } = await supabase
      .from("store_chats")
      .select("*", { count: "exact" })
      .eq("user_id", buyerId)
      .eq("sender", "seller")
      .eq("is_read", false);

    if (error) {
      console.error("[Chat] buyer unread count error:", error);
      return res.status(500).json({ success: false, error: "Failed to get unread count" });
    }

    return res.json({ success: true, unread: count || 0, user_role: "buyer" });
  } catch (err) {
    console.error("❌ getBuyerUnreadCount error:", err);
    return res.status(500).json({ success: false, error: "Failed to get unread count" });
  }
};

/**
 * Seller unread count per store
 */
export const getSellerUnreadCount = async (req, res) => {
  try {
    if (req.user.role !== "seller") {
      return res.status(403).json({ success: false, error: "Unauthorized: Seller endpoint only" });
    }

    const storeId = req.query.storeId;
    if (!storeId) return res.status(400).json({ success: false, error: "Missing storeId" });

    // Verify seller owns store
    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("user_id")
      .eq("id", storeId)
      .single();

    if (storeErr) {
      console.error("[Chat] seller unread store lookup error:", storeErr);
      return res.status(500).json({ success: false, error: "Failed to validate store" });
    }
    if (!store || store.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: "Unauthorized: You don't own this store" });
    }

    const { count, error } = await supabase
      .from("store_chats")
      .select("*", { count: "exact" })
      .eq("store_id", storeId)
      .eq("sender", "buyer")
      .eq("is_read", false);

    if (error) {
      console.error("[Chat] seller unread count DB error:", error);
      return res.status(500).json({ success: false, error: "Failed to get unread count" });
    }

    return res.json({ success: true, unread: count || 0, store_id: storeId, user_role: "seller" });
  } catch (err) {
    console.error("❌ getSellerUnreadCount error:", err);
    return res.status(500).json({ success: false, error: "Failed to get seller unread count" });
  }
};

