// middleware/csrf.js
import crypto from 'crypto';

/**
 * CSRF Protection for Stateless JWT Authentication
 * Uses Double-Submit Cookie Pattern
 */

const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * CSRF Token Middleware - Sets CSRF token cookie
 * Add this to index.js BEFORE routes
 */
export const csrfTokenMiddleware = (req, res, next) => {
  // Skip for debug endpoints and CSRF token endpoint itself
  if (req.path.startsWith('/api/debug/') || 
      req.path === '/api/csrf-token') {
    return next();
  }
  
  // Check if we already have a CSRF token
  let csrfToken = req.cookies['X-CSRF-TOKEN'];
  
  // If no token or token is invalid format, generate new one
  if (!csrfToken || csrfToken.length !== 64) {
    csrfToken = generateToken();
    
    // Set as readable cookie (NOT httpOnly - JS needs to read it)
    res.cookie('X-CSRF-TOKEN', csrfToken, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', // Strict for CSRF protection
      path: '/',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: false // ⭐ CRITICAL: Must be false for JavaScript access
    });
    
    console.log(`🔹 [CSRF] Generated new token for ${req.ip}`);
  }
  
  // Attach to request and response
  req.csrfToken = csrfToken;
  res.locals.csrfToken = csrfToken;
  
  next();
};

/**
 * CSRF Verification Middleware
 * Protect state-changing endpoints
 */
export const verifyCSRF = (req, res, next) => {
  // Skip safe methods (GET, HEAD, OPTIONS)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Skip auth endpoints (login/register/refresh) - they need special handling
  const skipPaths = [
    '/api/auth/buyer/login',
    '/api/auth/buyer/register',
    '/api/auth/buyer/refresh',
    '/api/auth/buyer/social-login',
    '/api/auth/seller/login',
    '/api/auth/seller/register',
    '/api/auth/seller/refresh',
    '/api/auth/seller/social-login'
  ];
  
  if (skipPaths.includes(req.path)) {
    console.log(`🔹 [CSRF] Skipping auth endpoint: ${req.path}`);
    return next();
  }
  
  // Get token from request headers
  const tokenFromRequest = 
    req.headers['x-csrf-token'] ||
    req.headers['x-xsrf-token'] ||
    req.body._csrf;
  
  // Get token from cookie
  const tokenFromCookie = req.cookies['X-CSRF-TOKEN'];
  
  console.log(`🔹 [CSRF Verify] ${req.method} ${req.path}`, {
    requestToken: tokenFromRequest ? 'present' : 'missing',
    cookieToken: tokenFromCookie ? 'present' : 'missing'
  });
  
  // Validate both exist and match
  if (!tokenFromRequest || !tokenFromCookie) {
    console.warn(`⚠️ [CSRF] Token missing`);
    return res.status(403).json({
      success: false,
      error: 'Security token missing. Please refresh the page.'
    });
  }
  
  if (tokenFromRequest !== tokenFromCookie) {
    console.error(`❌ [CSRF] Token mismatch`);
    return res.status(403).json({
      success: false,
      error: 'Invalid security token.'
    });
  }
  
  console.log(`✅ [CSRF] Verified successfully`);
  next();
};

/**
 * GET CSRF Token Endpoint
 * Frontend calls this to get current CSRF token
 */
export const getCSRFToken = (req, res) => {
  let token = req.cookies['X-CSRF-TOKEN'];
  
  // Generate new token if none exists
  if (!token) {
    token = generateToken();
    res.cookie('X-CSRF-TOKEN', token, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: false
    });
  }
  
  res.json({
    success: true,
    csrfToken: token,
    timestamp: new Date().toISOString()
  });
};

/**
 * Special CSRF for Auth Endpoints (Login/Register)
 * More lenient for first-time visitors
 */
export const verifyCSRFForAuth = (req, res, next) => {
  // Get tokens
  const tokenFromRequest = req.headers['x-csrf-token'];
  const tokenFromCookie = req.cookies['X-CSRF-TOKEN'];
  
  console.log(`🔹 [CSRF Auth] ${req.method} ${req.path}`, {
    requestToken: !!tokenFromRequest,
    cookieToken: !!tokenFromCookie
  });
  
  // If both exist, validate them
  if (tokenFromRequest && tokenFromCookie) {
    if (tokenFromRequest !== tokenFromCookie) {
      return res.status(403).json({
        success: false,
        error: 'Invalid security token.'
      });
    }
    return next();
  }
  
  // If no token in cookie, set one (new visitor)
  if (!tokenFromCookie) {
    const newToken = generateToken();
    res.cookie('X-CSRF-TOKEN', newToken, {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: false
    });
    console.log(`🔹 [CSRF Auth] Set new token for new visitor`);
  }
  
  // For auth endpoints, we're more lenient
  // Allow the request to proceed even without CSRF token
  // (User might be logging in for first time)
  next();
};