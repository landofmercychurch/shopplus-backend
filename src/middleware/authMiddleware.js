// authMiddleware.js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

// ============================================================
// Dynamic JWT authentication middleware for custom cookie names
// ============================================================
export const authenticateJWTWithCookie = (cookieName = 'accessToken') => (req, res, next) => {
  console.log(`🔹 [authenticateJWT] Checking cookie: ${cookieName} for request:`, req.method, req.originalUrl);

  try {
    const token = req.cookies?.[cookieName];
    console.log(`🔹 [authenticateJWT] Token from cookie "${cookieName}":`, token ? '[present]' : '[missing]');

    if (!token) {
      console.warn(`⚠️ [authenticateJWT] No token provided in cookie "${cookieName}"`);
      return res.status(401).json({ success: false, error: 'Unauthorized: No token provided.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('🔹 [authenticateJWT] Decoded JWT:', decoded);

    req.user = decoded;
    next();

  } catch (err) {
    console.error('❌ [authenticateJWT] Token verification error:', err.message);

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired. Please login again.' });
    }

    return res.status(401).json({ success: false, error: 'Invalid token.' });
  }
};

// ============================================================
// Legacy middleware for buyers (default cookie: accessToken)
// ============================================================
export const authenticateJWT = authenticateJWTWithCookie('accessToken');

// ============================================================
// Role-based authorization middleware
// ============================================================
export const authorizeRoles = (...allowedRoles) => (req, res, next) => {
  console.log('🔹 [authorizeRoles] Checking roles for user:', req.user?.role);

  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized: No user found in request.' });
  }

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions.' });
  }

  next();
};

