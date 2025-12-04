// controllers/buyer/authController.js
import { supabase } from '../../config/db.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '10m';
const REFRESH_EXPIRES_IN = 30 * 24 * 60 * 60 * 1000; // 30 days
const isProduction = process.env.NODE_ENV === 'production';

// Helper: consistent error response
const errorResponse = (res, status, message, details) => {
  const payload = { success: false, message };
  if (details) payload.details = details;
  return res.status(status).json(payload);
};

// ==================== REGISTER BUYER ====================
export const registerBuyer = async (req, res) => {
  try {
    const { full_name, email, password, phone_number } = req.body ?? {};
    if (!full_name || !email || !password || !phone_number) {
      return errorResponse(res, 400, 'Full name, email, password, and phone number are required.');
    }

    const role = 'buyer';

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role, phone_number },
    });
    if (authError) return errorResponse(res, authError.status || 400, authError.message, authError);

    const userId = authData.user.id;

    const profilePayload = {
      id: userId,
      full_name,
      role,
      phone_number,
      avatar_url: null,
      refresh_token: null,
      created_at: new Date().toISOString(),
    };

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .upsert([profilePayload], { onConflict: ['id'] })
      .select()
      .single();

    if (profileError) {
      try { await supabase.auth.admin.deleteUser(userId); } catch {}
      return errorResponse(res, 500, 'Failed to create user profile', profileError);
    }

    return res.status(201).json({
      success: true,
      message: 'Buyer registered successfully',
      user: { id: userId, email, full_name: profile.full_name, role: profile.role },
    });

  } catch (err) {
    return errorResponse(res, 500, 'Server error', { message: err.message });
  }
};

//// ==================== LOGIN BUYER ====================
export const loginBuyer = async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) return errorResponse(res, 400, 'Email and password are required.');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.user) return errorResponse(res, 401, error?.message || 'Invalid credentials');

    const userId = data.user.id;
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (profileError || !profile) return errorResponse(res, 404, 'Buyer profile not found');
    if (profile.role !== 'buyer') return errorResponse(res, 403, 'You must log in as a buyer');

    // Generate access token
    const accessToken = jwt.sign({ id: userId, role: profile.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Generate refresh token and store in DB
    const refreshToken = crypto.randomBytes(64).toString('hex');
    await supabase.from('user_profiles').update({ refresh_token: refreshToken }).eq('id', userId);

    // ============================================
    // CRITICAL FIX: Cookie settings for Render
    // ============================================
    
    // Get the origin from request to determine correct domain
    const origin = req.headers.origin || '';
    const isRenderDomain = origin.includes('.onrender.com');
    
    const cookieOptions = {
      httpOnly: true,
      secure: true, // ALWAYS true for Render (HTTPS)
      sameSite: 'none', // REQUIRED for cross-site
      path: '/'
    };
    
    // If it's a Render subdomain, set domain for cookie sharing
    if (isRenderDomain) {
      cookieOptions.domain = '.onrender.com'; // Dot prefix for subdomains
    }
    
    // Set access token cookie (10 minutes)
    res.cookie('accessToken', accessToken, {
      ...cookieOptions,
      maxAge: 10 * 60 * 1000 // 10 minutes
    });

    // Set refresh token cookie (30 days)
    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      maxAge: REFRESH_EXPIRES_IN // 30 days
    });
    
    // DEBUG LOGGING
    console.log('🍪 Login cookies set:', {
      accessTokenSet: !!accessToken,
      refreshTokenSet: !!refreshToken,
      options: cookieOptions,
      origin,
      userId
    });

    return res.status(200).json({
      success: true,
      message: 'Buyer login successful',
      user: { 
        id: userId, 
        email: data.user.email, 
        full_name: profile.full_name, 
        role: profile.role 
      },
      // Optional: For debugging, you can include token in response
      // but keep HTTP-only for production
      _debug: process.env.NODE_ENV !== 'production' ? { 
        accessTokenLength: accessToken?.length,
        refreshTokenLength: refreshToken?.length 
      } : undefined
    });

  } catch (err) {
    console.error('❌ Login error:', err);
    return errorResponse(res, 500, 'Server error', { message: err.message });
  }
};


// ==================== GET USER PROFILE ====================
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    res.status(200).json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile', details: err.message });
  }
};

// // ==================== LOGOUT ====================
export const logoutUser = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (userId) {
      await supabase.from('user_profiles').update({ refresh_token: null }).eq('id', userId);
    }

    const origin = req.headers.origin || '';
    const isRenderDomain = origin.includes('.onrender.com');
    
    // Clear cookies with same options
    const clearOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/'
    };
    
    if (isRenderDomain) {
      clearOptions.domain = '.onrender.com';
    }
    
    res.clearCookie('accessToken', clearOptions);
    res.clearCookie('refreshToken', clearOptions);

    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to logout', details: err.message });
  }
};


//// ==================== REFRESH ACCESS TOKEN ====================
export const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'No refresh token provided' });
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('refresh_token', refreshToken)
      .single();

    if (error || !profile) {
      return res.status(403).json({ success: false, message: 'Invalid refresh token' });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { id: profile.id, role: profile.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // ============================================
    // SAME COOKIE SETTINGS AS LOGIN
    // ============================================
    const origin = req.headers.origin || '';
    const isRenderDomain = origin.includes('.onrender.com');
    
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/'
    };
    
    if (isRenderDomain) {
      cookieOptions.domain = '.onrender.com';
    }
    
    res.cookie('accessToken', newAccessToken, {
      ...cookieOptions,
      maxAge: 10 * 60 * 1000 // 10 minutes
    });

    res.status(200).json({ 
      success: true, 
      message: 'Access token refreshed' 
    });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', details: err.message });
  }
};


// ==================== UPDATE USER PROFILE ====================
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    const { data: updatedProfile, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, message: 'Failed to update profile', details: error });

    res.status(200).json({ success: true, message: 'Profile updated successfully', profile: updatedProfile });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', details: err.message });
  }
};

