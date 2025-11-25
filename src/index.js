// ============================================================
// 🚀 SHOPPLUS BACKEND SERVER WITH SOCKET.IO NAMESPACE
// ============================================================

import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import http from "http";
import cookieParser from "cookie-parser";
import helmet from "helmet";


// Load environment variables
dotenv.config();

// ============================================================
// ⚙️  CONFIGURATION
// ============================================================

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// 🧩 CORS MIDDLEWARE
// ============================================================

const allowedOrigin = process.env.CLIENT_URL || "http://localhost:5173";

const corsOptions = {
  origin: allowedOrigin,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));

// Fix preflight handling (Express 5 compatible)
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Origin", allowedOrigin);
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    return res.sendStatus(204);
  }
  next();
});

// ============================================================
// 🧩 SECURITY HEADERS
// ============================================================

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", allowedOrigin],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  })
); // <-- closes app.use properly

// ============================================================
// 🧩 BODY PARSERS
// ============================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ============================================================
// 🔗 ROUTE IMPORTS
// ============================================================

import authRoutes from "./routes/authRoutes.js";
import sellerStoreRoutes from "./routes/seller/storeRoutes.js";
import buyerStoreRoutes from "./routes/buyer/storeRoutes.js";
import uploadRoutes from "./routes/upload.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import trackingRoutes from "./routes/trackingRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import favouritesRoutes from "./routes/favouritesRoutes.js";
import orderItemsRoutes from "./routes/orderItemsRoutes.js";
import paymentsRoutes from "./routes/paymentsRoutes.js";
import reviewsRoutes from "./routes/reviewsRoutes.js";
import shipmentsRoutes from "./routes/shipmentsRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import campaignRoutes from "./routes/campaignRoutes.js";
import followerRoutes from "./routes/followerRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import notificationsRoutes from "./routes/notificationsRoutes.js";


// ============================================================
// 🧭 ROUTE MOUNTING
// ============================================================

app.use("/api/auth", authRoutes);
app.use("/api/buyer/stores", buyerStoreRoutes);
app.use("/api/seller/stores", sellerStoreRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/favourites", favouritesRoutes);
app.use("/api/order-items", orderItemsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/shipments", shipmentsRoutes);
app.use("/api/followers", followerRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/uploads", uploadRoutes);



// ============================================================
// 🧪 HEALTH CHECK
// ============================================================

app.get("/", (req, res) => {
  res.json({
    message: "✅ ShopPlus backend running smoothly 🚀",
    environment: process.env.NODE_ENV || "development",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

// ============================================================
// 🚦 CREATE HTTP SERVER AND ATTACH SOCKET.IO
// ============================================================

const server = http.createServer(app);
import { Server } from "socket.io";
import { initChatSocket } from "./sockets/chatSocket.js";

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ============================================================
// 🧭 NAMESPACE SETUP
// ============================================================

const chatNamespace = io.of("/chat");
initChatSocket(chatNamespace);

// Attach namespace globally for backend access (controllers)
app.set("io", chatNamespace);

// ============================================================
// 🚀 START SERVER
// ============================================================

server.listen(PORT, () => {
  console.log(`✅ ShopPlus server running at: http://localhost:${PORT}`);
  console.log(`🟢 Socket.IO chat namespace ready at /chat`);
});
