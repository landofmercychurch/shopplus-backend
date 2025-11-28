//orderitemsController.js

import { supabase } from '../config/db.js';

export const addOrderItem = async (req, res) => {
  const { order_id, product_id, quantity, price } = req.body;
  try {
    const { data, error } = await supabase
      .from('order_items')
      .insert([{ order_id, product_id, quantity, price }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ message: 'Order item added', item: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getOrderItems = async (req, res) => {
  const { order_id } = req.params;
  try {
    const { data, error } = await supabase
      .from('order_items')
      .select('*, products(name, image_url)')
      .eq('order_id', order_id);
    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
