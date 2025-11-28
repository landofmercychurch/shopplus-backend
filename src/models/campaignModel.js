// src/models/campaignModel.js (Supabase version)
// This is optional — mainly for typing/utility functions, not schema definition

import { supabase } from '../config/db.js';

/**
 * Fetch campaigns with optional filters
 * @param {Object} filters - { query, storeId, minDiscount, maxDiscount, activeOnly }
 * @returns {Promise<Array>} - Array of campaigns
 */
export async function fetchCampaigns(filters = {}) {
  const { query = '', storeId, minDiscount, maxDiscount, activeOnly } = filters;

  let campaignQuery = supabase
    .from('campaigns')
    .select('*')
    .ilike('name', `%${query}%`); // case-insensitive search

  if (storeId) campaignQuery = campaignQuery.eq('store', storeId);
  if (minDiscount) campaignQuery = campaignQuery.gte('discount_percent', minDiscount);
  if (maxDiscount) campaignQuery = campaignQuery.lte('discount_percent', maxDiscount);
  if (activeOnly) campaignQuery = campaignQuery.eq('is_active', true);

  const { data, error } = await campaignQuery.limit(50);
  if (error) throw error;

  return data;
}

