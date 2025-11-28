import { supabase } from '../config/db.js';

export const createPayment = async (req, res) => {
  const { order_id, amount, method, transaction_ref } = req.body;
  try {
    const { data, error } = await supabase
      .from('payments')
      .insert([{ order_id, amount, method, transaction_ref }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ message: 'Payment record created', payment: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getPaymentByOrder = async (req, res) => {
  const { order_id } = req.params;
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', order_id)
      .single();
    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
