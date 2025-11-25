import { supabase } from '../config/db.js';

/**
 * Fetch a user by ID
 * @param {string} id - User ID
 */
export async function getUserById(id) {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

/**
 * Create a new user
 * @param {Object} userData
 */
export async function createUser(userData) {
  const { data, error } = await supabase.from('users').insert([userData]).select().single();
  if (error) throw error;
  return data;
}

/**
 * Update a user
 * @param {string} id
 * @param {Object} updates
 */
export async function updateUser(id, updates) {
  const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

/**
 * Search users by name or email
 * @param {string} query
 */
export async function searchUsers(query) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .or(`name.ilike.%${query}%,email.ilike.%${query}%`);
  if (error) throw error;
  return data;
}

