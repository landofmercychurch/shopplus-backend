// controllers/orderController.js
import { supabase } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

// Commission percentage (platform takes 5% by default)
const COMMISSION_PERCENT = 5;

// Helper: consistent error response
const errorResponse = (res, status, message, details) => {
  const payload = { success: false, message };
  if (details) payload.details = details;
  return res.status(status).json(payload);
};

// ---------------- CREATE ORDER ----------------
export const createOrder = async (req, res) => {
  const { seller_id, store_id, total_amount, payment_method, shipping_address } = req.body;
  const buyer_id = req.user.id;

  try {
    // 1️⃣ Get default shipping address if none provided
    let finalShippingAddress = shipping_address;
    if (!shipping_address) {
      const { data: defaultAddress, error: addressError } = await supabase
        .from('buyer_metadata')
        .select('address1, address2, city, state, country, postal_code, label')
        .eq('user_id', buyer_id)
        .eq('is_default', true)
        .single();

      if (addressError) console.warn('⚠️ No default address found:', addressError.message);

      if (defaultAddress) {
        finalShippingAddress = `${defaultAddress.address1}${defaultAddress.address2 ? ', ' + defaultAddress.address2 : ''}, ${defaultAddress.city}, ${defaultAddress.state}, ${defaultAddress.country} ${defaultAddress.postal_code || ''}`;
      }
    }

    // 2️⃣ Insert order
    const tracking_number = `SP${uuidv4().split('-')[0].toUpperCase()}`;
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        buyer_id,
        seller_id,
        store_id,
        total_amount,
        payment_method,
        shipping_address: finalShippingAddress,
        tracking_number,
        status: 'pending' // default
      }])
      .select()
      .single();

    if (orderError) throw orderError;

    // 3️⃣ Calculate commission
    const commissionAmount = (total_amount * COMMISSION_PERCENT) / 100;

    // 4️⃣ Insert platform revenue
    await supabase.from('platform_revenue').insert([{
      order_id: order.id,
      seller_id,
      amount: commissionAmount
    }]);

    // 5️⃣ Update seller wallet
    const { data: wallet, error: walletError } = await supabase
      .from('seller_wallets')
      .select('*')
      .eq('seller_id', seller_id)
      .single();

    const sellerCredit = total_amount - commissionAmount;

    if (walletError || !wallet) {
      // create wallet if it doesn't exist
      await supabase.from('seller_wallets').insert([{
        seller_id,
        balance: 0,
        pending: sellerCredit
      }]);
    } else {
      await supabase.from('seller_wallets')
        .update({ pending: wallet.pending + sellerCredit })
        .eq('seller_id', seller_id);
    }

    // 6️⃣ Insert wallet transaction (pending)
    await supabase.from('wallet_transactions').insert([{
      seller_id,
      order_id: order.id,
      type: 'pending',
      amount: sellerCredit,
      description: `Pending payment for order ${order.id}`
    }]);

    res.status(201).json({ success: true, message: 'Order created successfully', order });
  } catch (err) {
    console.error('❌ Error creating order:', err);
    return errorResponse(res, 500, 'Failed to create order', err.message);
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
    res.status(200).json({ success: true, orders: data });
  } catch (err) {
    console.error('❌ Error fetching all orders:', err);
    return errorResponse(res, 500, 'Failed to fetch orders', err.message);
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

    if (error || !data) return errorResponse(res, 404, 'Order not found');
    res.status(200).json({ success: true, order: data });
  } catch (err) {
    console.error('❌ Error fetching order by ID:', err);
    return errorResponse(res, 500, 'Failed to fetch order', err.message);
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
    res.status(200).json({ success: true, orders });
  } catch (err) {
    console.error('❌ Error fetching orders for buyer:', err);
    return errorResponse(res, 500, 'Failed to fetch your orders', err.message);
  }
};

// ---------------- GET ORDERS BY BUYER ----------------
export const getOrdersByBuyer = async (req, res) => {
  const { buyer_id } = req.params;

  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('buyer_id', buyer_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json({ success: true, orders });
  } catch (err) {
    console.error(`❌ Error fetching orders for buyer ${buyer_id}:`, err);
    return errorResponse(res, 500, 'Failed to fetch orders', err.message);
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
    res.status(200).json({ success: true, orders: data });
  } catch (err) {
    console.error(`❌ Error fetching orders for seller ${seller_id}:`, err);
    return errorResponse(res, 500, 'Failed to fetch orders', err.message);
  }
};

// ---------------- UPDATE ORDER STATUS ----------------
export const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

  if (!validStatuses.includes(status)) 
    return res.status(400).json({ success: false, message: 'Invalid status value.' });

  try {
    // Get current order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();
    if (orderError || !order) 
      return res.status(404).json({ success: false, message: 'Order not found' });

    // Update order status
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (updateError) throw updateError;

    // If delivered, move pending to balance
    if (status === 'delivered') {
      const { data: wallet, error: walletError } = await supabase
        .from('seller_wallets')
        .select('*')
        .eq('seller_id', order.seller_id)
        .single();
      if (!wallet || walletError) throw new Error('Seller wallet not found');

      const { data: pendingTransaction } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('order_id', order.id)
        .eq('type', 'pending')
        .single();

      const pendingAmount = pendingTransaction?.amount || 0;

      if (pendingAmount > 0) {
        await supabase.from('seller_wallets').update({
          balance: wallet.balance + pendingAmount,
          pending: wallet.pending - pendingAmount
        }).eq('seller_id', order.seller_id);

        await supabase.from('wallet_transactions').insert([{
          seller_id: order.seller_id,
          order_id: order.id,
          type: 'credit',
          amount: pendingAmount,
          description: `Payment released for delivered order ${order.id}`
        }]);

        await supabase.from('wallet_transactions')
          .update({ type: 'processed' })
          .eq('id', pendingTransaction.id);
      }
    }

    res.status(200).json({ success: true, message: 'Order status updated', order: updatedOrder });
  } catch (err) {
    console.error(`❌ Error updating status for order ${id}:`, err);
    return res.status(500).json({ success: false, message: 'Failed to update order status', details: err.message });
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

    if (error || !order) return errorResponse(res, 404, 'Order not found');
    if (order.buyer_id !== userId) return errorResponse(res, 403, 'You can only cancel your own orders');
    if (order.status !== 'pending') return errorResponse(res, 400, 'Only pending orders can be cancelled');

    const { data: cancelledOrder, error: updateError } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;
    res.status(200).json({ success: true, message: 'Order cancelled', order: cancelledOrder });
  } catch (err) {
    console.error('❌ Error cancelling order:', err);
    return errorResponse(res, 500, 'Failed to cancel order', err.message);
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

    if (error || !data) return errorResponse(res, 404, 'Tracking number not found');
    res.status(200).json({ success: true, order: data });
  } catch (err) {
    console.error('❌ Error tracking order:', err);
    return errorResponse(res, 500, 'Failed to track order', err.message);
  }
};

// ---------------- DELETE ORDER ----------------
export const deleteOrder = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) throw error;
    res.status(200).json({ success: true, message: 'Order deleted' });
  } catch (err) {
    console.error(`❌ Error deleting order ${id}:`, err);
    return errorResponse(res, 500, 'Failed to delete order', err.message);
  }
};

// ---------------- CAN REVIEW PRODUCT ----------------
export const canReviewProduct = async (req, res) => {
  const { productId } = req.params;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return errorResponse(res, 401, 'No token provided');

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return errorResponse(res, 401, 'Invalid or expired token');

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
    return errorResponse(res, 500, 'Failed to check review permission', err.message);
  }
};

