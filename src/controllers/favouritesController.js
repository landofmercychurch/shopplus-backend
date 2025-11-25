import { supabase } from '../config/db.js';

// Add to favourites
export const addFavourite = async (req, res) => {
  const { buyer_id, product_id } = req.body;
  try {
    const { data, error } = await supabase
      .from('favourites')
      .insert([{ buyer_id, product_id }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ message: 'Added to favourites', favourite: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get favourites by buyer
export const getFavourites = async (req, res) => {
  const { buyer_id } = req.params;
  try {
    const { data, error } = await supabase
      .from('favourites')
      .select('*, products(name, price, image_url)')
      .eq('buyer_id', buyer_id);
    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Remove favourite
export const removeFavourite = async (req, res) => {
  const { buyer_id, product_id } = req.params; // <-- use params now
  try {
    const { error } = await supabase
      .from('favourites')
      .delete()
      .match({ buyer_id, product_id });
    if (error) throw error;
    res.status(200).json({ message: 'Removed from favourites' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

