// src/routes/categoryRoutes.js
import express from 'express';
import { supabase } from '../config/db.js';

const router = express.Router();

// GET all categories
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Failed to fetch categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

export default router;

