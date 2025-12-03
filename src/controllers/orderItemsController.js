// controllers/orderItemsController.js
import { supabase } from '../config/db.js';

// Commission percentage (platform takes 5% by default)
const COMMISSION_PERCENT = 5;

// Helper: consistent error response
const errorResponse = (res, status, message, details) => {
  const payload = { success: false, message };
  if (details) payload.details = details;
  return res.status(status).json(payload);
};

// ---------------- ADD ORDER ITEM ----------------
export const addOrderItem = async (req, res) => {
  const { order_id, product_id, quantity, price } = req.body;

  if (!order_id || !product_id || !quantity || !price) {
    return errorResponse(res, 400, 'Missing required fields');
  }

  try {
    // 1️⃣ Insert the order item
    const { data: item, error: insertError } = await supabase
      .from('order_items')
      .insert([{ order_id, product_id, quantity, price }])
      .select()
      .single();

    if (insertError) throw insertError;

    // 2️⃣ Get the order to identify the seller
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) throw new Error('Order not found');

    // 3️⃣ Calculate commission and seller pending amount for this item
    const totalPrice = price * quantity;
    const commissionAmount = (totalPrice * COMMISSION_PERCENT) / 100;
    const sellerPending = totalPrice - commissionAmount;

    // 4️⃣ Update seller wallet pending balance
    const { data: wallet, error: walletError } = await supabase
      .from('seller_wallets')
      .select('*')
      .eq('seller_id', order.seller_id)
      .single();

    if (!wallet || walletError) {
      // Create wallet if it doesn't exist
      await supabase.from('seller_wallets').insert([{
        seller_id: order.seller_id,
        balance: 0,
        pending: sellerPending
      }]);
    } else {
      // Add to existing pending balance
      await supabase.from('seller_wallets')
        .update({ pending: wallet.pending + sellerPending })
        .eq('seller_id', order.seller_id);
    }

    // 5️⃣ Insert wallet transaction (pending)
    await supabase.from('wallet_transactions').insert([{
      seller_id: order.seller_id,
      order_id,
      type: 'pending',
      amount: sellerPending,
      description: `Pending payment for order item ${product_id} (Order ${order_id})`
    }]);

    // 6️⃣ Insert platform revenue for this item
    await supabase.from('platform_revenue').insert([{
      order_id,
      seller_id: order.seller_id,
      amount: commissionAmount
    }]);

    res.status(201).json({ success: true, message: 'Order item added and wallet updated', item });

  } catch (err) {
    console.error('❌ Error adding order item:', err);
    return errorResponse(res, 500, 'Failed to add order item', err.message);
  }
};

// ---------------- GET ORDER ITEMS ----------------
export const getOrderItems = async (req, res) => {
  const { order_id } = req.params;

  if (!order_id) return errorResponse(res, 400, 'Order ID is required');

  try {
    const { data, error } = await supabase
      .from('order_items')
      .select(`
        *,
        products (
          id,
          name,
          image_url,
          price
        )
      `)
      .eq('order_id', order_id);

    if (error) throw error;

    res.status(200).json({ success: true, order_items: data });

  } catch (err) {
    console.error('❌ Error fetching order items:', err);
    return errorResponse(res, 500, 'Failed to fetch order items', err.message);
  }
};

// ---------------- GET ALL ITEMS FOR A PRODUCT (OPTIONAL) ----------------
export const getItemsByProduct = async (req, res) => {
  const { product_id } = req.params;

  if (!product_id) return errorResponse(res, 400, 'Product ID is required');

  try {
    const { data, error } = await supabase
      .from('order_items')
      .select('*, orders(status, tracking_number)')
      .eq('product_id', product_id);

    if (error) throw error;

    res.status(200).json({ success: true, items: data });

  } catch (err) {
    console.error('❌ Error fetching items for product:', err);
    return errorResponse(res, 500, 'Failed to fetch items for product', err.message);
  }
};

