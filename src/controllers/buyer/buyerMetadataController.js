import { supabase } from '../../config/db.js';

// ============================================================
// Helper: consistent error response
// ============================================================
const errorResponse = (res, status, message, details) => {
  const payload = { success: false, message };
  if (details) payload.details = details;
  return res.status(status).json(payload);
};

// ============================================================
// GET ALL ADDRESSES FOR CURRENT BUYER
// ============================================================
export const getBuyerAddresses = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return errorResponse(res, 401, 'Unauthorized');

    const { data, error } = await supabase
      .from('buyer_metadata')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) return errorResponse(res, 500, 'Failed to fetch addresses', error);

    return res.status(200).json({ success: true, addresses: data });
  } catch (err) {
    return errorResponse(res, 500, 'Server error', { message: err.message });
  }
};

// ============================================================
// ADD NEW ADDRESS
// ============================================================
export const addBuyerAddress = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return errorResponse(res, 401, 'Unauthorized');

    const {
      label,
      full_name,
      phone_number,
      address1,
      address2,
      city,
      state,
      country,
      postal_code,
      latitude,
      longitude,
      is_default,
    } = req.body ?? {};

    if (!label || !full_name || !phone_number || !address1 || !city || !state) {
      return errorResponse(res, 400, 'Missing required fields');
    }

    // If this address is default, unset other default addresses
    if (is_default) {
      await supabase.from('buyer_metadata').update({ is_default: false }).eq('user_id', userId);
    }

    const { data, error } = await supabase.from('buyer_metadata').insert([
      {
        user_id: userId,
        label,
        full_name,
        phone_number,
        address1,
        address2: address2 || null,
        city,
        state,
        country: country || 'Nigeria',
        postal_code: postal_code || null,
        latitude: latitude || null,
        longitude: longitude || null,
        is_default: !!is_default,
      },
    ]).select().single();

    if (error) return errorResponse(res, 500, 'Failed to add address', error);

    return res.status(201).json({ success: true, address: data });
  } catch (err) {
    return errorResponse(res, 500, 'Server error', { message: err.message });
  }
};

// ============================================================
// UPDATE EXISTING ADDRESS
// ============================================================
export const updateBuyerAddress = async (req, res) => {
  try {
    const userId = req.user?.id;
    const addressId = req.params.id;
    if (!userId) return errorResponse(res, 401, 'Unauthorized');

    const updates = { ...req.body };

    // If updating default, unset other defaults
    if (updates.is_default) {
      await supabase.from('buyer_metadata').update({ is_default: false }).eq('user_id', userId);
    }

    const { data, error } = await supabase
      .from('buyer_metadata')
      .update(updates)
      .eq('id', addressId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) return errorResponse(res, 400, 'Failed to update address', error);

    return res.status(200).json({ success: true, address: data });
  } catch (err) {
    return errorResponse(res, 500, 'Server error', { message: err.message });
  }
};

// ============================================================
// DELETE ADDRESS
// ============================================================
export const deleteBuyerAddress = async (req, res) => {
  try {
    const userId = req.user?.id;
    const addressId = req.params.id;
    if (!userId) return errorResponse(res, 401, 'Unauthorized');

    const { error } = await supabase
      .from('buyer_metadata')
      .delete()
      .eq('id', addressId)
      .eq('user_id', userId);

    if (error) return errorResponse(res, 400, 'Failed to delete address', error);

    return res.status(200).json({ success: true, message: 'Address deleted successfully' });
  } catch (err) {
    return errorResponse(res, 500, 'Server error', { message: err.message });
  }
};

// ============================================================
// SET DEFAULT ADDRESS
// ============================================================
export const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user?.id;
    const addressId = req.params.id;
    if (!userId) return errorResponse(res, 401, 'Unauthorized');

    // Unset previous default
    await supabase.from('buyer_metadata').update({ is_default: false }).eq('user_id', userId);

    // Set new default
    const { data, error } = await supabase
      .from('buyer_metadata')
      .update({ is_default: true })
      .eq('id', addressId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) return errorResponse(res, 400, 'Failed to set default address', error);

    return res.status(200).json({ success: true, address: data });
  } catch (err) {
    return errorResponse(res, 500, 'Server error', { message: err.message });
  }
};