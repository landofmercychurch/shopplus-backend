// controllers/storeController.js
import { supabase } from '../config/db.js';

// ========================== CREATE OR UPDATE STORE ==========================
export const createOrUpdateStore = async (req, res) => {
  const {
    name,
    description,
    logo_url,
    banner_url,
    phone,
    facebook_url,
    instagram_url,
    tiktok_url,
    website_url,
    shipping_policy,
    return_policy,
    opening_hours,
    label, // 'warehouse' or 'storefront'
    full_name,
    address1,
    address2,
    city,
    state,
    country,
    postal_code,
    latitude,
    longitude,
    lga,
    google_place_id,
    formatted_address,
  } = req.body;

  const user_id = req.user?.id;

  if (!user_id || !name || !phone || !address1 || !city || !state || !lga || !postal_code || !latitude || !longitude) {
    return res.status(400).json({ error: 'Required store and address fields are missing.' });
  }

  try {
    // Check if the seller already has a store
    const { data: existingStore, error: existingError } = await supabase
      .from('stores')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (existingError && existingError.code !== 'PGRST116') throw existingError;

    const storeData = {
      name,
      description: description || null,
      logo_url: logo_url || null,
      banner_url: banner_url || null,
      phone,
      facebook_url: facebook_url || null,
      instagram_url: instagram_url || null,
      tiktok_url: tiktok_url || null,
      website_url: website_url || null,
      shipping_policy: shipping_policy || null,
      return_policy: return_policy || null,
      opening_hours: opening_hours || null,
    };

    let store;
    if (existingStore) {
      // Update existing store
      const { data, error } = await supabase
        .from('stores')
        .update(storeData)
        .eq('user_id', user_id)
        .select()
        .single();
      if (error) throw error;
      store = data;
    } else {
      // Insert new store
      const { data, error } = await supabase
        .from('stores')
        .insert([{ user_id, ...storeData }])
        .select()
        .single();
      if (error) throw error;
      store = data;
    }

    // ================== CREATE OR UPDATE STORE ADDRESS ==================
    const addressData = {
      store_id: store.id,
      label: label || 'storefront',
      full_name,
      phone_number: phone,
      address1,
      address2: address2 || null,
      city,
      state,
      country: country || 'Nigeria',
      postal_code,
      latitude,
      longitude,
      lga,
      is_default: true,
      google_place_id: google_place_id || null,
      formatted_address: formatted_address || null,
    };

    const { data: existingAddress } = await supabase
      .from('store_addresses')
      .select('*')
      .eq('store_id', store.id)
      .single();

    if (existingAddress) {
      await supabase.from('store_addresses').update(addressData).eq('store_id', store.id);
    } else {
      await supabase.from('store_addresses').insert([addressData]);
    }

    res.status(existingStore ? 200 : 201).json({
      message: existingStore ? 'Store updated successfully.' : 'Store created successfully.',
      store,
    });

  } catch (err) {
    console.error('❌ Store create/update error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

// ========================== GET ALL STORES ==========================
export const getAllStores = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    console.error('❌ Get all stores error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ========================== GET STORE BY STORE ID ==========================
export const getStoreById = async (req, res) => {
  const { storeId } = req.params;
  try {
    const { data, error } = await supabase.from('stores').select('*').eq('id', storeId).single();
    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    console.error('❌ Get store by ID error:', err);
    res.status(404).json({ error: 'Store not found.' });
  }
};

// ========================== GET STORE BY USER ID ==========================
export const getStoreByUserId = async (req, res) => {
  const { userId } = req.params;
  try {
    const { data, error } = await supabase.from('stores').select('*').eq('user_id', userId).single();
    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    console.error('❌ Get store by user ID error:', err);
    res.status(404).json({ error: 'Store not found.' });
  }
};

// ========================== UPDATE STORE BY ID ==========================
export const updateStoreById = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user?.id;
  const updates = req.body;

  try {
    const { data: store, error: getError } = await supabase.from('stores').select('*').eq('id', id).single();
    if (getError) throw getError;

    if (store.user_id !== user_id) return res.status(403).json({ error: 'Unauthorized to update this store.' });

    const { data: updatedStore, error } = await supabase.from('stores').update(updates).eq('id', id).select().single();
    if (error) throw error;

    // Update store address
    const addressData = {
      store_id: id,
      label: updates.label || 'storefront',
      full_name: updates.full_name,
      phone_number: updates.phone,
      address1: updates.address1,
      address2: updates.address2 || null,
      city: updates.city,
      state: updates.state,
      country: updates.country || 'Nigeria',
      postal_code: updates.postal_code,
      latitude: updates.latitude,
      longitude: updates.longitude,
      lga: updates.lga,
      is_default: true,
      google_place_id: updates.google_place_id || null,
      formatted_address: updates.formatted_address || null,
    };

    const { data: existingAddress } = await supabase.from('store_addresses').select('*').eq('store_id', id).single();
    if (existingAddress) {
      await supabase.from('store_addresses').update(addressData).eq('store_id', id);
    } else {
      await supabase.from('store_addresses').insert([addressData]);
    }

    res.status(200).json({ message: 'Store updated successfully.', store: updatedStore });
  } catch (err) {
    console.error('❌ Update store error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ========================== DELETE STORE BY ID ==========================
export const deleteStoreById = async (req, res) => {
  const { id } = req.params;
  try {
    const { data: store, error: getError } = await supabase.from('stores').select('*').eq('id', id).single();
    if (getError) throw getError;

    if (store.user_id !== req.user?.id) return res.status(403).json({ error: 'Unauthorized to delete this store.' });

    const { error } = await supabase.from('stores').delete().eq('id', id);
    if (error) throw error;

    res.status(200).json({ message: 'Store deleted successfully.' });
  } catch (err) {
    console.error('❌ Delete store error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ========================== SEARCH STORES ==========================
export const searchStores = async (req, res) => {
  const { query } = req.query;
  try {
    const { data, error } = await supabase.from('stores').select('*').ilike('name', `%${query}%`);
    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    console.error('❌ Search stores error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ========================== GET PRODUCTS BY STORE ==========================
export const getProductsByStore = async (req, res) => {
  const { storeId } = req.params;
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    console.error("❌ Get products by store error:", err);
    res.status(500).json({ error: err.message });
  }
};

