import { supabase } from '../config/db.js';

export const createShipment = async (req, res) => {
  const { order_id, courier_name, tracking_number, estimated_delivery } = req.body;
  try {
    const { data, error } = await supabase
      .from('shipments')
      .insert([{ order_id, courier_name, tracking_number, estimated_delivery }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ message: 'Shipment created', shipment: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateShipmentStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const { data, error } = await supabase
      .from('shipments')
      .update({ status, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.status(200).json({ message: 'Shipment updated', shipment: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getShipmentByOrder = async (req, res) => {
  const { order_id } = req.params;
  try {
    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .eq('order_id', order_id)
      .single();
    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
