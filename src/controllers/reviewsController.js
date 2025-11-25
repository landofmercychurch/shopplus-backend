import { supabase } from '../config/db.js';

// ====================== ADD REVIEW ======================
export const addReview = async (req, res) => {
  const { product_id, rating, comment } = req.body;

  if (!product_id || !rating) {
    return res.status(400).json({ error: 'Product ID and rating are required' });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  const buyer_id = req.user?.id; // ✅ get buyer from decoded JWT
  if (!buyer_id) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data, error } = await supabase
      .from('reviews')
      .insert([{ product_id, buyer_id, rating, comment }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ message: 'Review added', review: data });
  } catch (err) {
    console.error('❌ Add review error:', err);
    res.status(500).json({ error: 'Failed to add review' });
  }
};

// ====================== GET REVIEWS BY PRODUCT ======================
export const getReviewsByProduct = async (req, res) => {
  const { productId } = req.params;

  if (!productId) {
    return res.status(400).json({ error: 'Product ID is required' });
  }

  try {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        comment,
        created_at,
        buyer:buyer_id (id, email)
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json(data);
  } catch (err) {
    console.error('❌ Get reviews error:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
};

