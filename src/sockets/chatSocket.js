// backend/chatsocket.js
import jwt from "jsonwebtoken";
import { supabase } from "../config/db.js";

/**
 * Initializes the /chat namespace for Socket.IO
 * Handles chat messages, typing, and notifications
 * @param {Namespace} nsp - Socket.IO namespace (io.of("/chat"))
 */
export const initChatSocket = (nsp) => {
  // ----------------------------
  // JWT authentication middleware
  // ----------------------------
  nsp.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Unauthorized"));

    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = user; // attach user info
      next();
    } catch (err) {
      console.error("❌ Invalid JWT in socket:", err.message);
      next(new Error("Unauthorized"));
    }
  });

  // ----------------------------
  // Socket events
  // ----------------------------
  nsp.on("connection", (socket) => {
    const { id: userId, role } = socket.user;
    console.log(`✅ User connected to /chat: ${userId} (${role})`);

    // ----------------------------
    // Join chat room
    // ----------------------------
    socket.on("join_room", ({ storeId, buyerId }) => {
      if (!storeId) return console.error("⚠️ join_room missing storeId");

      if (role === "buyer") {
        const room = `store_${storeId}_buyer_${userId}`;
        socket.join(room);
        console.log(`📦 Buyer ${userId} joined room: ${room}`);
      } else if (role === "seller") {
        const room = `store_${storeId}_seller`;
        socket.join(room);
        console.log(`📦 Seller ${userId} joined room: ${room}`);
      }
    });

    // ----------------------------
    // Send chat message
    // ----------------------------
    socket.on("send_message", async ({ storeId, chat }) => {
      try {
        if (!storeId || !chat || typeof chat !== "object") return;

        const {
          message,
          sender,
          message_type = "text",
          reply_to = null,
          order_id = null,
          file_url = null,
          file_type = null,
          system_event = null,
          targetUserId = null, // buyerId if seller sending
        } = chat;

        if (!message && !file_url && !system_event) return;

        const user_id = sender === "buyer" ? userId : targetUserId;

        const id = crypto.randomUUID?.() || require("uuid").v4();
        const timestamp = new Date();

        // ----------------------------
        // Save to Supabase
        // ----------------------------
        const { data, error } = await supabase
          .from("store_chats")
          .insert({
            id,
            store_id: storeId,
            user_id,
            sender,
            message: message || "",
            message_type,
            reply_to,
            order_id,
            file_url,
            file_type,
            system_event,
            is_read: sender === "seller" ? true : false,
            created_at: timestamp,
            edited_at: null,
          })
          .select("*")
          .single();

        if (error) throw error;

        const savedChat = data;

        // ----------------------------
        // Emit to buyer and seller rooms
        // ----------------------------
        const buyerRoom = `store_${storeId}_buyer_${user_id}`;
        const sellerRoom = `store_${storeId}_seller`;

        nsp.to(buyerRoom).emit("receive_message", savedChat);
        nsp.to(sellerRoom).emit("receive_message", savedChat);

      } catch (err) {
        console.error("❌ send_message error:", err.message);
      }
    });

    // ----------------------------
    // Typing indicator
    // ----------------------------
    socket.on("typing", ({ storeId, sender, targetUserId }) => {
      if (!storeId || !sender) return;

      let room = "";
      if (sender === "buyer") room = `store_${storeId}_seller`;
      else if (sender === "seller" && targetUserId) room = `store_${storeId}_buyer_${targetUserId}`;
      if (!room) return;

      nsp.to(room).emit("typing", { sender });
    });

    // ----------------------------
    // Mark messages read (seller)
    // ----------------------------
    socket.on("mark_read", async ({ storeId, buyerId }) => {
      if (!storeId || !buyerId) return;

      try {
        const { error } = await supabase
          .from("store_chats")
          .update({ is_read: true })
          .eq("store_id", storeId)
          .eq("user_id", buyerId)
          .eq("sender", "buyer")
          .eq("is_read", false);

        if (error) throw error;

        nsp.to(`store_${storeId}_seller`).emit("messages_read", { storeId, buyerId });
      } catch (err) {
        console.error("❌ mark_read error:", err.message);
      }
    });

    // ----------------------------
    // Notifications room
    // ----------------------------
    const notificationRoom = String(userId);
    socket.join(notificationRoom);

    socket.on("fetch_unread", async ({ limit = 20 }) => {
      try {
        const { data: notifications, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) throw error;
        socket.emit("unread_notifications", notifications);
      } catch (err) {
        console.error("❌ fetch_unread error:", err.message);
      }
    });

    socket.sendNotification = (notification) => {
      nsp.to(notificationRoom).emit("new-notification", notification);
    };

    // ----------------------------
    // Disconnect
    // ----------------------------
    socket.on("disconnect", () => {
      console.log(`❌ User disconnected from /chat: ${userId}`);
    });
  });

  console.log("🟢 /chat namespace initialized");
};

