// backend/chatsocket.js
import jwt from "jsonwebtoken";
import { supabase } from "../config/db.js";
import cookie from "cookie";

/**
 * Initializes the /chat namespace for Socket.IO
 * Handles chat messages, typing, and notifications
 * @param {Namespace} nsp - Socket.IO namespace (io.of("/chat"))
 */
export const initChatSocket = (nsp) => {
  // ----------------------------
  // UPDATED: JWT authentication middleware checking BOTH cookies
  // ----------------------------
  nsp.use((socket, next) => {
    console.log('🔹 [Socket Auth] New connection attempt');
    
    const cookies = socket.handshake.headers.cookie || "";
    console.log('🔹 [Socket Auth] Raw cookies:', cookies);
    
    const parsedCookies = cookie.parse(cookies);
    
    // Check for accessToken first (used by buyers and some sellers)
    let token = parsedCookies.accessToken;
    let tokenSource = 'accessToken';
    
    // If no accessToken, check for sellerAccessToken (used by sellers)
    if (!token && parsedCookies.sellerAccessToken) {
      token = parsedCookies.sellerAccessToken;
      tokenSource = 'sellerAccessToken';
      console.log('🔹 [Socket Auth] Using sellerAccessToken cookie');
    }
    
    // Debug log
    console.log(`🔹 [Socket Auth] Token from ${tokenSource}:`, token ? '[PRESENT]' : '[MISSING]');
    
    if (!token) {
      console.error('❌ [Socket Auth] No token found in cookies');
      console.error('❌ [Socket Auth] Available cookies:', Object.keys(parsedCookies));
      return next(new Error("Unauthorized: No token provided"));
    }

    try {
      // Verify the JWT token
      const user = jwt.verify(token, process.env.JWT_SECRET);
      
      // Log successful verification
      console.log(`✅ [Socket Auth] Token verified from ${tokenSource}:`, {
        id: user.id,
        role: user.role,
        email: user.email
      });
      
      // Attach user info to socket
      socket.user = user;
      socket.tokenSource = tokenSource; // Store which token was used
      
      next();
    } catch (err) {
      console.error("❌ [Socket Auth] Invalid JWT:", err.message);
      
      if (err.name === 'TokenExpiredError') {
        console.error('❌ [Socket Auth] Token expired');
        return next(new Error("Token expired. Please login again."));
      }
      
      if (err.name === 'JsonWebTokenError') {
        console.error('❌ [Socket Auth] JWT error:', err.message);
        return next(new Error("Invalid token."));
      }
      
      return next(new Error("Unauthorized"));
    }
  });

  // ----------------------------
  // Socket events
  // ----------------------------
  nsp.on("connection", (socket) => {
    const { id: userId, role } = socket.user;
    const tokenSource = socket.tokenSource;
    
    console.log(`✅ ${role.toUpperCase()} connected to /chat: ${userId} (using ${tokenSource})`);

    // ----------------------------
    // Join chat room
    // ----------------------------
    socket.on("join_room", ({ storeId, buyerId }) => {
      console.log(`🔹 [join_room] Request from ${role} ${userId}:`, { storeId, buyerId });
      
      if (!storeId) {
        console.error("⚠️ [join_room] Missing storeId");
        return;
      }

      if (role === "buyer") {
        const room = `store_${storeId}_buyer_${userId}`;
        socket.join(room);
        console.log(`📦 Buyer ${userId} joined room: ${room}`);
        
        // Also join personal notification room
        socket.join(`user_${userId}`);
        
      } else if (role === "seller") {
        const room = `store_${storeId}_seller`;
        socket.join(room);
        console.log(`🛍️ Seller ${userId} joined room: ${room}`);
        
        // Also join personal notification room
        socket.join(`user_${userId}`);
        
        // Join seller-specific room
        socket.join(`seller_${userId}`);
      }
    });

    // ----------------------------
    // Send chat message
    // ----------------------------
    socket.on("send_message", async ({ storeId, chat }) => {
      console.log(`🔹 [send_message] From ${role} ${userId}:`, { storeId, chat });
      
      try {
        if (!storeId || !chat || typeof chat !== "object") {
          console.error("⚠️ [send_message] Invalid parameters");
          return;
        }

        const {
          message,
          sender,
          message_type = "text",
          reply_to = null,
          order_id = null,
          file_url = null,
          file_type = null,
          system_event = null,
          targetUserId = null,
        } = chat;

        // Validate required fields
        if (!message && !file_url && !system_event) {
          console.error("⚠️ [send_message] No message content");
          return;
        }

        // IMPORTANT: Validate sender matches role
        if (role === "seller" && sender !== "seller") {
          console.error(`❌ [send_message] Seller ${userId} trying to send as ${sender}`);
          return;
        }
        
        if (role === "buyer" && sender !== "buyer") {
          console.error(`❌ [send_message] Buyer ${userId} trying to send as ${sender}`);
          return;
        }

        // Determine user_id for the message
        const user_id = sender === "buyer" ? userId : targetUserId;
        
        if (!user_id) {
          console.error("❌ [send_message] Missing user_id");
          return;
        }

        // Generate message ID
        const id = crypto.randomUUID?.() || require("uuid").v4();
        const timestamp = new Date();

        console.log(`💾 [send_message] Saving to database:`, {
          storeId,
          userId: user_id,
          sender,
          message: message?.substring(0, 50) + '...'
        });

        // Save to database
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

        if (error) {
          console.error("❌ [send_message] Database error:", error.message);
          throw error;
        }

        const savedChat = data;
        
        // Define rooms
        const buyerRoom = `store_${storeId}_buyer_${user_id}`;
        const sellerRoom = `store_${storeId}_seller`;
        
        console.log(`📤 [send_message] Emitting to rooms:`, { buyerRoom, sellerRoom });

        // Emit to appropriate rooms
        nsp.to(buyerRoom).emit("receive_message", savedChat);
        nsp.to(sellerRoom).emit("receive_message", savedChat);
        
        // Also send to personal rooms for real-time updates
        nsp.to(`user_${user_id}`).emit("receive_message", savedChat);
        
        console.log(`✅ [send_message] Message sent successfully`);
        
      } catch (err) {
        console.error("❌ [send_message] Error:", err.message);
        // Optionally emit error back to sender
        socket.emit("message_error", { error: err.message });
      }
    });

    // ----------------------------
    // Typing indicator
    // ----------------------------
    socket.on("typing", ({ storeId, sender, targetUserId }) => {
      console.log(`🔹 [typing] From ${role} ${userId}:`, { storeId, sender, targetUserId });
      
      if (!storeId || !sender) {
        console.error("⚠️ [typing] Missing parameters");
        return;
      }
      
      // Validate sender matches role
      if (role === "seller" && sender !== "seller") {
        console.error(`❌ [typing] Seller ${userId} trying to type as ${sender}`);
        return;
      }
      
      if (role === "buyer" && sender !== "buyer") {
        console.error(`❌ [typing] Buyer ${userId} trying to type as ${sender}`);
        return;
      }

      let room = "";
      if (sender === "buyer") {
        room = `store_${storeId}_seller`;
      } else if (sender === "seller" && targetUserId) {
        room = `store_${storeId}_buyer_${targetUserId}`;
      }
      
      if (!room) {
        console.error("⚠️ [typing] Could not determine room");
        return;
      }
      
      console.log(`⌨️ [typing] Emitting to room: ${room}`);
      nsp.to(room).emit("typing", { sender, userId });
    });

    // ----------------------------
    // Mark messages read (seller)
    // ----------------------------
    socket.on("mark_read", async ({ storeId, buyerId }) => {
      console.log(`🔹 [mark_read] From ${role} ${userId}:`, { storeId, buyerId });
      
      // Only sellers can mark messages as read
      if (role !== "seller") {
        console.error(`❌ [mark_read] Non-seller ${role} ${userId} attempted mark_read`);
        socket.emit("mark_read_error", { error: "Only sellers can mark messages as read" });
        return;
      }
      
      if (!storeId || !buyerId) {
        console.error("⚠️ [mark_read] Missing parameters");
        return;
      }
      
      try {
        console.log(`📝 [mark_read] Updating messages for buyer ${buyerId} in store ${storeId}`);
        
        const { error } = await supabase
          .from("store_chats")
          .update({ is_read: true })
          .eq("store_id", storeId)
          .eq("user_id", buyerId)
          .eq("sender", "buyer")
          .eq("is_read", false);

        if (error) {
          console.error("❌ [mark_read] Database error:", error.message);
          throw error;
        }
        
        // Notify the seller room
        nsp.to(`store_${storeId}_seller`).emit("messages_read", { storeId, buyerId, markedBy: userId });
        console.log(`✅ [mark_read] Messages marked as read`);
        
      } catch (err) {
        console.error("❌ [mark_read] Error:", err.message);
        socket.emit("mark_read_error", { error: err.message });
      }
    });

    // ----------------------------
    // Notifications
    // ----------------------------
    const notificationRoom = `user_${userId}`;
    socket.join(notificationRoom);
    console.log(`🔔 [notifications] ${role} ${userId} joined notification room: ${notificationRoom}`);
    
    socket.on("fetch_unread", async ({ limit = 20 }) => {
      console.log(`🔔 [fetch_unread] Request from ${role} ${userId}, limit: ${limit}`);
      
      try {
        const { data: notifications, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) {
          console.error("❌ [fetch_unread] Database error:", error.message);
          throw error;
        }
        
        console.log(`🔔 [fetch_unread] Sending ${notifications?.length || 0} unread notifications`);
        socket.emit("unread_notifications", notifications || []);
        
      } catch (err) {
        console.error("❌ [fetch_unread] Error:", err.message);
        socket.emit("fetch_unread_error", { error: err.message });
      }
    });
    
    // Helper to send notifications to this user
    socket.sendNotification = (notification) => {
      console.log(`🔔 [sendNotification] Sending to ${role} ${userId}:`, notification);
      nsp.to(notificationRoom).emit("new-notification", notification);
    };

    // ----------------------------
    // Disconnect
    // ----------------------------
    socket.on("disconnect", () => {
      console.log(`❌ ${role.toUpperCase()} disconnected from /chat: ${userId}`);
    });

    // ----------------------------
    // Error handling
    // ----------------------------
    socket.on("error", (error) => {
      console.error(`❌ Socket error for ${role} ${userId}:`, error);
    });
  });

  console.log("🟢 /chat namespace initialized with dual cookie support (accessToken & sellerAccessToken)");
};
