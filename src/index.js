// ============================================================
// 🚀 SHOPPLUS BACKEND SERVER WITH SOCKET.IO NAMESPACE
// ============================================================

import 'dotenv/config';
import express from "express";
import cors from "cors";
import http from "http";
import cookieParser from "cookie-parser";
import helmet from "helmet";

// Load environment variables

// ============================================================
// ⚙️  CONFIGURATION
// ============================================================

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// 🧩 CRITICAL: TRUST PROXY (Render requires this for cookies)
// ============================================================
app.set("trust proxy", 1);

// ============================================================
// 🧩 CORS MIDDLEWARE - UPDATED FOR RENDER COOKIES
// ============================================================

// Get allowed origin from env or use Render frontend
const allowedOrigin = process.env.CLIENT_URL || "https://shopplus-frontend-uj8c.onrender.com";

console.log('🔧 CORS Configuration:', {
  allowedOrigin,
  nodeEnv: process.env.NODE_ENV,
  isProduction: process.env.NODE_ENV === 'production'
});

// CRITICAL FIX: For Render, we need to handle all subdomains
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      allowedOrigin,
      "https://shopplus-frontend-uj8c.onrender.com",
      "https://landofmercychurch.github.io",
      "https://landofmercychurch.github.io/shopplus-frontend",
      "http://localhost:5173", // For local development
      "http://localhost:3000"
    ];
    
    // Check if the origin is in the allowed list
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // MUST BE TRUE FOR COOKIES
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  exposedHeaders: ["set-cookie"], // IMPORTANT: Expose set-cookie header
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// ============================================================
// 🧩 CRITICAL COOKIE PARSER MIDDLEWARE
// ============================================================
app.use(cookieParser());

// ============================================================
// 🧩 SECURITY HEADERS
// ============================================================

// Allow ALL your frontend deployments
const frontends = [
  allowedOrigin,
  "https://shopplus-frontend-uj8c.onrender.com",
  "https://landofmercychurch.github.io",
  "https://landofmercychurch.github.io/shopplus-frontend",
  "http://localhost:5173",
  "http://localhost:3000"
];

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'", ...frontends],
      scriptSrc: ["'self'", "'unsafe-inline'", ...frontends],
      styleSrc: ["'self'", "'unsafe-inline'", ...frontends],
      imgSrc: ["'self'", "data:", "blob:", ...frontends],
      connectSrc: ["'self'", ...frontends],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameSrc: ["'self'", ...frontends],
      baseUri: ["'self'"],
      formAction: ["'self'", ...frontends],
    },
  })
);

// ============================================================
// 🧩 BODY PARSERS
// ============================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// 🔗 ROUTE IMPORTS
// ============================================================

import buyerRoutes from "./routes/auth/buyerRoutes.js";
import buyerMetadataRoutes from "./routes/buyer/buyerMetadataRoutes.js";
import sellerRoutes from "./routes/auth/sellerRoutes.js";
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
import walletRoutes from './routes/walletRoutes.js';
import Openrouteservice from "openrouteservice-js";
import shippingRoutes from './routes/shippingRoutes.js';

// ============================================================
// 🧭 ROUTE MOUNTING
// ============================================================

app.use('/api/auth/seller', sellerRoutes);
app.use('/api/auth/buyer', buyerRoutes);
app.use("/api/buyer/stores", buyerStoreRoutes);
app.use("/api/buyer/metadata", buyerMetadataRoutes);
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
app.use('/api/wallets', walletRoutes);
app.use('/api/shipping', shippingRoutes);

// ============================================================
// 🧪 DEBUG ENDPOINTS FOR COOKIE TESTING
// ============================================================

app.get("/api/debug/cookies", (req, res) => {
  console.log('🔍 Debug Cookies - Headers:', req.headers);
  console.log('🔍 Debug Cookies - Cookies received:', req.cookies);
  console.log('🔍 Debug Cookies - Origin:', req.headers.origin);
  
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    cookies: req.cookies,
    headers: {
      origin: req.headers.origin,
      cookie: req.headers.cookie,
      'user-agent': req.headers['user-agent']
    },
    serverInfo: {
      nodeEnv: process.env.NODE_ENV,
      isProduction: process.env.NODE_ENV === 'production',
      trustProxy: app.get("trust proxy")
    }
  });
});

app.get("/api/debug/cors", (req, res) => {
  res.json({
    success: true,
    corsConfigured: true,
    allowedOrigin: allowedOrigin,
    credentials: true,
    timestamp: new Date().toISOString()
  });
});

// Test endpoint to set cookies
app.get("/api/debug/set-test-cookie", (req, res) => {
  // CRITICAL: Cookie settings for Render
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie('test_access_token', 'test_jwt_token_123', {
    httpOnly: true,
    secure: isProduction, // TRUE on Render (HTTPS)
    sameSite: 'none', // REQUIRED for cross-site cookies
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/'
    // Note: Don't set domain on Render subdomains
  });
  
  res.cookie('test_refresh_token', 'test_refresh_token_456', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/'
  });
  
  console.log('🍪 Test cookies set with options:', {
    secure: isProduction,
    sameSite: 'none',
    httpOnly: true
  });
  
  res.json({
    success: true,
    message: 'Test cookies set',
    cookiesSet: ['test_access_token', 'test_refresh_token'],
    cookieOptions: {
      secure: isProduction,
      sameSite: 'none',
      httpOnly: true
    }
  });
});

// ============================================================
// 🧪 HEALTH CHECK
// ============================================================

app.get("/", (req, res) => {
  res.json({
    message: "✅ ShopPlus backend running smoothly 🚀",
    environment: process.env.NODE_ENV || "development",
    cors: {
      allowedOrigin,
      credentials: true
    },
    cookies: {
      testEndpoint: "/api/debug/set-test-cookie",
      debugEndpoint: "/api/debug/cookies"
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
    method: req.method
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
    origin: function (origin, callback) {
      // Same CORS logic as above
      const allowedOrigins = [
        allowedOrigin,
        "https://shopplus-frontend-uj8c.onrender.com",
        "https://landofmercychurch.github.io",
        "https://landofmercychurch.github.io/shopplus-frontend",
        "http://localhost:5173",
        "http://localhost:3000"
      ];
      
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }
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
  console.log(`🔧 CORS configured for: ${allowedOrigin}`);
  console.log(`🔐 Cookie settings: secure=${process.env.NODE_ENV === 'production'}, sameSite=none`);
  console.log(`🧪 Debug endpoints:`);
  console.log(`   - GET /api/debug/cookies - Check received cookies`);
  console.log(`   - GET /api/debug/set-test-cookie - Set test cookies`);
  console.log(`🟢 Socket.IO chat namespace ready at /chat`);
});