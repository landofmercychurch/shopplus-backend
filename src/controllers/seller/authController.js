// controllers/seller/authController.js
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

// ==================== REGISTER SELLER ====================
export const registerSeller = async (req, res) => {
  try {
    const { full_name, email, password, phone_number } = req.body ?? {};
    if (!full_name || !email || !password || !phone_number) {
      return errorResponse(res, 400, 'Full name, email, password, and phone number are required.');
    }

    const role = 'seller';

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
      return errorResponse(res, 500, 'Failed to create seller profile', profileError);
    }

    res.status(201).json({
      success: true,
      message: 'Seller registered successfully',
      user: profile,
    });

  } catch (err) {
    return errorResponse(res, 500, 'Server error', { message: err.message });
  }
};

// ==================== LOGIN SELLER ====================
export const loginSeller = async (req, res) => {
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

    if (profileError || !profile) return errorResponse(res, 404, 'Seller profile not found');
    if (profile.role !== 'seller') return errorResponse(res, 403, 'You must log in as a seller');

    // Generate access token
    const accessToken = jwt.sign({ id: userId, email: data.user.email, role: profile.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Generate refresh token
    const refreshToken = crypto.randomBytes(64).toString('hex');
    await supabase.from('user_profiles').update({ refresh_token: refreshToken }).eq('id', userId);

    // Set HttpOnly cookies with **seller-specific names**
    res.cookie('sellerAccessToken', accessToken, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 10 * 60 * 1000 });
    res.cookie('sellerRefreshToken', refreshToken, { httpOnly: true, secure: true, sameSite: 'none', maxAge: REFRESH_EXPIRES_IN });

    return res.status(200).json({
      success: true,
      message: 'Seller login successful',
      user: profile,
    });

  } catch (err) {
    return errorResponse(res, 500, 'Server error', { message: err.message });
  }
};

// ==================== GET CURRENT SELLER (/me) ====================
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) return errorResponse(res, 404, 'Profile not found');

    res.status(200).json({ success: true, user: profile });
  } catch (err) {
    return errorResponse(res, 500, 'Server error', { message: err.message });
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

    if (error) return errorResponse(res, 400, 'Failed to update profile', error);

    res.status(200).json({ success: true, message: 'Profile updated successfully', user: updatedProfile });
  } catch (err) {
    return errorResponse(res, 500, 'Server error', { message: err.message });
  }
};

// ==================== REFRESH ACCESS TOKEN ====================
export const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.sellerRefreshToken;
    if (!refreshToken) return errorResponse(res, 401, 'No refresh token provided');

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('refresh_token', refreshToken)
      .single();

    if (error || !profile) return errorResponse(res, 403, 'Invalid refresh token');

    const newAccessToken = jwt.sign({ id: profile.id, email: profile.email, role: profile.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.cookie('sellerAccessToken', newAccessToken, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 10 * 60 * 1000 });

    res.status(200).json({ success: true, message: 'Access token refreshed', user: profile });
  } catch (err) {
    return errorResponse(res, 500, 'Server error', { message: err.message });
  }
};

// ==================== LOGOUT SELLER ====================
export const logoutUser = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (userId) {
      await supabase.from('user_profiles').update({ refresh_token: null }).eq('id', userId);
    }

    res.clearCookie('sellerAccessToken', { httpOnly: true, secure: true, sameSite: 'none' });
    res.clearCookie('sellerRefreshToken', { httpOnly: true, secure: true, sameSite: 'none' });

    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    return errorResponse(res, 500, 'Server error', { message: err.message });
  }
};

