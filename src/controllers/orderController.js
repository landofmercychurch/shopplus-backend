// controllers/orderController.js
import { supabase } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

// ---------------- CREATE ORDER ----------------
export const createOrder = async (req, res) => {
  const { seller_id, store_id, total_amount, payment_method, shipping_address } = req.body;
  const buyer_id = req.user.id;

  try {
    const tracking_number = `SP${uuidv4().split('-')[0].toUpperCase()}`;
    const { data, error } = await supabase
      .from('orders')
      .insert([{ buyer_id, seller_id, store_id, total_amount, payment_method, shipping_address, tracking_number }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ message: 'Order created successfully', order: data });
  } catch (err) {
    console.error('❌ Error creating order:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
};

// ---------------- GET ALL ORDERS (ADMIN) ----------------
export const getAllOrders = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    console.error('❌ Error fetching all orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

// ---------------- GET ORDER BY ID ----------------
export const getOrderById = async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Order not found' });
    res.status(200).json(data);
  } catch (err) {
    console.error('❌ Error fetching order by ID:', err);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
};

// ---------------- GET ORDERS FOR LOGGED-IN BUYER ----------------
export const getOrdersForLoggedInBuyer = async (req, res) => {
  const buyer_id = req.user.id;

  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          product_id,
          quantity,
          price,
          products(name)
        )
      `)
      .eq('buyer_id', buyer_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json(orders);
  } catch (err) {
    console.error('❌ Error fetching orders for logged-in buyer:', err);
    res.status(500).json({ error: 'Failed to fetch your orders' });
  }
};

// ---------------- GET ORDERS BY BUYER (ADMIN / ANALYTICS) ----------------
export const getOrdersByBuyer = async (req, res) => {
  const { buyer_id } = req.params;

  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('buyer_id', buyer_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json(orders);
  } catch (err) {
    console.error(`❌ Error fetching orders for buyer ${buyer_id}:`, err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

// ---------------- GET ORDERS BY SELLER ----------------
export const getOrdersBySeller = async (req, res) => {
  const { seller_id } = req.params;

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('seller_id', seller_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    console.error(`❌ Error fetching orders for seller ${seller_id}:`, err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

// ---------------- UPDATE ORDER STATUS ----------------
export const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status value.' });

  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.status(200).json({ message: 'Order status updated successfully', order: data });
  } catch (err) {
    console.error(`❌ Error updating status for order ${id}:`, err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

// ---------------- CANCEL ORDER ----------------
export const cancelOrder = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !order) return res.status(404).json({ error: 'Order not found' });
    if (order.buyer_id !== userId) return res.status(403).json({ error: 'You can only cancel your own orders' });
    if (order.status !== 'pending') return res.status(400).json({ error: 'Only pending orders can be cancelled' });

    const { data: cancelledOrder, error: updateError } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;
    res.status(200).json({ message: 'Order cancelled successfully', order: cancelledOrder });
  } catch (err) {
    console.error('❌ Error cancelling order:', err);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
};

// ---------------- TRACK ORDER ----------------
export const trackOrder = async (req, res) => {
  const { tracking_number } = req.params;

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('tracking_number', tracking_number)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Tracking number not found' });
    res.status(200).json(data);
  } catch (err) {
    console.error('❌ Error tracking order:', err);
    res.status(500).json({ error: 'Failed to track order' });
  }
};

// ---------------- DELETE ORDER ----------------
export const deleteOrder = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) throw error;
    res.status(200).json({ message: 'Order deleted successfully' });
  } catch (err) {
    console.error(`❌ Error deleting order ${id}:`, err);
    res.status(500).json({ error: 'Failed to delete order' });
  }
};

// ---------------- CAN REVIEW PRODUCT ----------------
export const canReviewProduct = async (req, res) => {
  const { productId } = req.params;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Invalid or expired token' });

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('buyer_id', user.id);

    if (ordersError) throw ordersError;

    const orderIds = orders.map(o => o.id);
    if (!orderIds.length) return res.status(200).json({ canReview: false });

    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('order_id')
      .eq('product_id', productId)
      .in('order_id', orderIds);

    if (itemsError) throw itemsError;
    res.status(200).json({ canReview: orderItems.length > 0 });
  } catch (err) {
    console.error('❌ Can review check error:', err);
    res.status(500).json({ error: 'Failed to check review permission' });
  }
};

