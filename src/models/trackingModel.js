import { supabase } from '../config/db.js';

/**
 * Create a tracking entry for an order
 * @param {Object} trackingData
 */
export async function createTracking(trackingData) {
  const { data, error } = await supabase.from('tracking').insert([trackingData]).select().single();
  if (error) throw error;
  return data;
}

/**
 * Update tracking status
 * @param {string} trackingId
 * @param {string} status
 */
export async function updateTrackingStatus(trackingId, status) {
  const { data, error } = await supabase
    .from('tracking')
    .update({ status })
    .eq('id', trackingId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Get tracking info by order ID
 * @param {string} orderId
 */
export async function getTrackingByOrder(orderId) {
  const { data, error } = await supabase.from('tracking').select('*').eq('order_id', orderId);
  if (error) throw error;
  return data;
}

/**
 * Search tracking entries by customer name or order ID
 */
export async function searchTracking(query) {
  const { data, error } = await supabase
    .from('tracking')
    .select('*')
    .or(`customer_name.ilike.%${query}%,order_id.ilike.%${query}%`);
  if (error) throw error;
  return data;
}

