// controllers/authController.js
import { supabase } from '../config/db.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '10m'; // short expiry
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';
const isProduction = process.env.NODE_ENV === 'production';

// Helper: consistent error response
const errorResponse = (res, status, message, details) => {
  const payload = { success: false, message };
  if (details) payload.details = details;
  return res.status(status).json(payload);
};

// ==================== REGISTER USER ====================
export const registerUser = async (req, res) => {
  try {
    const { full_name, email, password, role, phone_number, address, store_name } = req.body ?? {};

    if (!full_name || !email || !password || !role || !phone_number) {
      return errorResponse(res, 400, 'Full name, email, password, phone number, and role are required.');
    }

    const normalizedRole = role.toLowerCase();
    if (!['buyer', 'seller'].includes(normalizedRole)) {
      return errorResponse(res, 400, 'Invalid role. Must be "buyer" or "seller".');
    }

    if (normalizedRole === 'seller' && !store_name) {
      return errorResponse(res, 400, 'Store name is required for sellers.');
    }

    // Create Supabase user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role: normalizedRole, phone_number, address: address || '', store_name: normalizedRole === 'seller' ? store_name : null },
    });

    if (authError) {
      console.error('registerUser: auth creation failed', authError);
      return errorResponse(res, authError.status || 400, authError.message, authError);
    }

    const userId = authData.user.id;
    const profilePayload = {
      id: userId,
      full_name,
      role: normalizedRole,
      phone_number,
      address: address || '',
      store_name: normalizedRole === 'seller' ? store_name : null,
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
      message: 'User registered successfully',
      user: { id: userId, email, full_name: profile.full_name, role: profile.role, store_name: profile.store_name },
    });

  } catch (err) {
    return errorResponse(res, 500, 'Server error', { message: err.message });
  }
};

// ==================== LOGIN USER ====================
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) return errorResponse(res, 400, 'Email and password are required.');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.session) return errorResponse(res, 401, error?.message || 'Invalid credentials');

    const userId = data.user.id;
    const { data: profile, error: profileError } = await supabase.from('user_profiles').select('*').eq('id', userId).single();
    if (profileError || !profile) return errorResponse(res, 404, 'User profile not found');

    // Generate access token (10-min expiry)
    const payload = { id: userId, email: data.user.email, role: profile.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Generate refresh token and store in DB
    const refreshToken = crypto.randomBytes(64).toString('hex');
    await supabase.from('user_profiles').update({ refresh_token: refreshToken }).eq('id', userId);

    // Set HttpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Check if seller has a store
    let has_store = false;
    if (profile.role === 'seller') {
      const { data: store } = await supabase.from('stores').select('id').eq('user_id', userId).maybeSingle();
      has_store = !!store?.id;
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token, // access token stored in frontend memory
      user: { id: userId, email: data.user.email, full_name: profile.full_name, role: profile.role, store_name: profile.store_name, has_store },
    });

  } catch (err) {
    return errorResponse(res, 500, 'Server error', { message: err.message });
  }
};

// ==================== REFRESH ACCESS TOKEN ====================
export const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return errorResponse(res, 400, 'Refresh token is required');

    const { data: profile, error: profileError } = await supabase.from('user_profiles').select('*').eq('refresh_token', refreshToken).single();
    if (profileError || !profile) return errorResponse(res, 401, 'Invalid refresh token');

    const payload = { id: profile.id, email: profile.email, role: profile.role };
    const newToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return res.status(200).json({ success: true, token: newToken });

  } catch (err) {
    return errorResponse(res, 500, 'Server error', { message: err.message });
  }
};

// ==================== LOGOUT ====================
export const logoutUser = async (req, res) => {
  try {
    res.clearCookie('refreshToken', { httpOnly: true, secure: isProduction, sameSite: 'strict' });
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    return errorResponse(res, 500, 'Server error', { message: err.message });
  }
};

// ==================== GET USER PROFILE ====================
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return errorResponse(res, 401, 'Unauthorized');

    const { data: profile, error } = await supabase.from('user_profiles').select('*').eq('id', userId).single();
    if (error || !profile) return errorResponse(res, 404, 'User profile not found');

    return res.status(200).json({ success: true, profile });

  } catch (err) {
    return errorResponse(res, 500, 'Server error', { message: err.message });
  }
};

// ==================== UPDATE USER PROFILE ====================
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return errorResponse(res, 401, 'Unauthorized');

    const { full_name, phone_number, address, store_name, avatar_url } = req.body ?? {};
    const updates = {};
    if (full_name) updates.full_name = full_name;
    if (phone_number) updates.phone_number = phone_number;
    if (address !== undefined) updates.address = address;
    if (store_name !== undefined) updates.store_name = store_name;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    const { data: updatedProfile, error } = await supabase.from('user_profiles').update(updates).eq('id', userId).select().single();
    if (error || !updatedProfile) return errorResponse(res, 400, 'Failed to update profile', error);

    return res.status(200).json({ success: true, profile: updatedProfile });

  } catch (err) {
    return errorResponse(res, 500, 'Server error', { message: err.message });
  }
};

