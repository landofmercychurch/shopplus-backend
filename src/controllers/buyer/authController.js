// controllers/buyer/authController.js
import { supabase } from '../../config/db.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '10m';
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

    // Create Supabase user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role, phone_number },
    });

    if (authError) {
      console.error('registerBuyer: auth creation failed', authError);
      return errorResponse(res, authError.status || 400, authError.message, authError);
    }

    const userId = authData.user.id;

    // Insert into user_profiles table
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

// ==================== LOGIN BUYER ====================
export const loginBuyer = async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) return errorResponse(res, 400, 'Email and password are required.');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.session) return errorResponse(res, 401, error?.message || 'Invalid credentials');

    const userId = data.user.id;
    const { data: profile, error: profileError } = await supabase.from('user_profiles').select('*').eq('id', userId).single();
    if (profileError || !profile) return errorResponse(res, 404, 'Buyer profile not found');

    if (profile.role !== 'buyer') return errorResponse(res, 403, 'You must log in as a buyer');

    // Generate access token
    const token = jwt.sign({ id: userId, email: data.user.email, role: profile.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Generate refresh token and store in DB
    const refreshToken = crypto.randomBytes(64).toString('hex');
    await supabase.from('user_profiles').update({ refresh_token: refreshToken }).eq('id', userId);

    // Set HttpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: 'Buyer login successful',
      token,
      user: { id: userId, email: data.user.email, full_name: profile.full_name, role: profile.role },
    });

  } catch (err) {
    return errorResponse(res, 500, 'Server error', { message: err.message });
  }
};