import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

// ============================================================
// Middleware to authenticate JWT (normal + social login)
// ============================================================
export const authenticateJWT = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized: No token provided.' });
    }

    const token = authHeader.split(' ')[1].trim();

    // Verify token (works for social login JWTs too, as long as they are signed with JWT_SECRET)
    const decoded = jwt.verify(token, JWT_SECRET);

    // Log the decoded JWT payload
    console.log('Decoded JWT:', decoded);

    // Attach user info to request
    req.user = decoded; 
    // expected: { id, email, role, provider } 
    // "provider" can be "local", "google", "facebook", "apple"

    next();

  } catch (err) {
    console.error('❌ Token verification error:', err.message);

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired. Please login again.' });
    }

    return res.status(401).json({ success: false, error: 'Invalid token.' });
  }
};

// ============================================================
// Middleware to authorize based on user roles
// ============================================================
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized: No user found in request.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions.' });
    }

    next();
  };
};