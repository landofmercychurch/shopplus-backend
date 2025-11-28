// src/models/cartModel.js
import { supabase } from "../config/db.js";

const TABLE = 'cart';

export const addToCart = async (userId, productId, quantity = 1) => {
  const { data, error } = await supabase
    .from(TABLE)
    .insert([{ user_id: userId, product_id: productId, quantity }])
    .select();

  if (error) throw error;
  return data[0];
};

export const getCart = async (userId) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, product_id, quantity, product:products(*)') // join product info
    .eq('user_id', userId);

  if (error) throw error;
  return data;
};

export const updateCartItem = async (cartId, quantity) => {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ quantity })
    .eq('id', cartId)
    .select();

  if (error) throw error;
  return data[0];
};

export const removeCartItem = async (cartId) => {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', cartId);

  if (error) throw error;
  return true;
};

export const getCartCount = async (userId) => {
  const { count, error } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact' })
    .eq('user_id', userId);

  if (error) throw error;
  return count || 0;
};

