//routes/walletRoutes.js
import express from 'express';
import { supabase } from '../config/db.js';
import { authenticateJWT } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get seller wallet info
router.get('/seller/:seller_id', authenticateJWT, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('seller_wallets')
      .select('*')
      .eq('seller_id', req.params.seller_id)
      .single();
    if (error) throw error;
    res.status(200).json({ success: true, wallet: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get wallet transactions
router.get('/transactions/:seller_id', authenticateJWT, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('seller_id', req.params.seller_id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.status(200).json({ success: true, transactions: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

