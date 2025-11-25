import { supabase } from '../config/db.js';

/**
 * Fetch products with optional filters
 * @param {Object} options
 * @param {string} options.query - Search term
 * @param {string} options.category - Category ID
 * @param {number} options.minPrice - Minimum price
 * @param {number} options.maxPrice - Maximum price
 * @param {string} options.brand - Brand name
 * @param {number} options.rating - Minimum rating
 * @param {number} options.limit - Number of results
 * @param {number} options.offset - For pagination
 * @returns {Array} products
 */
export async function fetchProducts({
  query = '',
  category,
  minPrice,
  maxPrice,
  brand,
  rating,
  limit = 50,
  offset = 0,
}) {
  let productQuery = supabase.from('products').select('*');

  if (query) productQuery = productQuery.ilike('name', `%${query}%`);
  if (category) productQuery = productQuery.eq('category', category);
  if (brand) productQuery = productQuery.eq('brand', brand);
  if (minPrice) productQuery = productQuery.gte('price', minPrice);
  if (maxPrice) productQuery = productQuery.lte('price', maxPrice);
  if (rating) productQuery = productQuery.gte('rating', rating);

  const { data, error } = await productQuery.range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

