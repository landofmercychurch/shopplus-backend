// controllers/buyer/socialBuyerAuthController.js
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

// ==================== SOCIAL LOGIN/REGISTER BUYER ====================
export const socialLoginBuyer = async (req, res) => {
  try {
    const { email, full_name, provider_id, provider_name } = req.body ?? {};

    if (!email || !full_name || !provider_id || !provider_name) {
      return errorResponse(res, 400, 'Email, full name, provider ID, and provider name are required');
    }

    const role = 'buyer';

    // Check if user exists in Supabase auth
    const { data: allUsers } = await supabase.auth.admin.listUsers();
    let existingUser = allUsers.users.find(u => u.email === email);

    let userId;

    if (!existingUser) {
      // Create new Supabase user (social login)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: crypto.randomBytes(16).toString('hex'), // random password
        email_confirm: true,
        user_metadata: { full_name, role, provider_id, provider_name },
      });

      if (authError) return errorResponse(res, authError.status || 400, authError.message, authError);
      userId = authData.user.id;

      // Create user profile
      const profilePayload = {
        id: userId,
        full_name,
        role,
        avatar_url: null,
        refresh_token: null,
        created_at: new Date().toISOString(),
      };

      const { error: profileError } = await supabase.from('user_profiles').upsert([profilePayload]);
      if (profileError) return errorResponse(res, 500, 'Failed to create buyer profile', profileError);
    } else {
      userId = existingUser.id;
    }

    // Generate JWT (includes provider info)
    const tokenPayload = { id: userId, email, role, provider: provider_name };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Generate refresh token and store in DB
    const refreshToken = crypto.randomBytes(64).toString('hex');
    await supabase.from('user_profiles').update({ refresh_token: refreshToken }).eq('id', userId);

    // Set HttpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return res.status(200).json({
      success: true,
      message: 'Buyer social login successful',
      token,
      user: { id: userId, email, full_name, role, provider: provider_name },
    });

  } catch (err) {
    return errorResponse(res, 500, 'Server error', { message: err.message });
  }
};