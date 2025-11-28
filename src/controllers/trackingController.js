import { supabase } from '../config/db.js';

/**
 * POST /api/tracking
 * Add a new tracking update
 */
export const addTrackingUpdate = async (req, res) => {
  try {
    const { order_id, status, location, message } = req.body;

    if (!order_id || !status) {
      return res.status(400).json({ error: 'order_id and status are required' });
    }

    const { data, error } = await supabase
      .from('order_tracking')
      .insert([{ order_id, status, location, message }])
      .select();

    if (error) throw error;

    res.status(201).json({
      message: 'Tracking update added successfully',
      tracking: data[0],
    });
  } catch (err) {
    console.error('❌ Error adding tracking update:', err);
    res.status(500).json({ error: 'Failed to add tracking update' });
  }
};

/**
 * GET /api/tracking/order/:order_id
 * Get all tracking updates for a specific order
 */
export const getTrackingByOrder = async (req, res) => {
  try {
    const { order_id } = req.params;

    const { data, error } = await supabase
      .from('order_tracking')
      .select('*')
      .eq('order_id', order_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json(data || []);
  } catch (err) {
    console.error('❌ Error fetching tracking updates:', err);
    res.status(500).json({ error: 'Failed to fetch tracking updates' });
  }
};

/**
 * GET /api/tracking
 * Admin: get all tracking entries
 */
export const getAllTracking = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('order_tracking')
      .select('*, orders(buyer_id, total_amount)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json(data || []);
  } catch (err) {
    console.error('❌ Error fetching all tracking records:', err);
    res.status(500).json({ error: 'Failed to fetch tracking records' });
  }
};

/**
 * DELETE /api/tracking/:id
 * Delete a tracking record (admin)
 */
export const deleteTracking = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('order_tracking')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({ message: 'Tracking record deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting tracking record:', err);
    res.status(500).json({ error: 'Failed to delete tracking record' });
  }
};

