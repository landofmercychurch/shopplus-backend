// src/controllers/cartController.js
import {
  addToCart as addCartItem,
  getCart as getCartItems,
  updateCartItem as updateCart,
  removeCartItem as removeCart,
  getCartCount as fetchCartCount
} from '../models/cartModel.js';

// ---------------- HELPER: format cart items ----------------
const formatCartItems = (items) => {
  return items.map(item => ({
    id: item.id,
    product_id: item.product_id.id || item.product_id,
    seller_id: item.product?.seller_id || null,
    store_id: item.product?.store_id || null,
    name: item.product?.name || '',
    price: Number(item.product?.price || 0),
    quantity: item.quantity,
    subtotal: Number(item.product?.price || 0) * item.quantity
  }));
};

// ---------------- GET ALL CART ITEMS ----------------
export const getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const items = await getCartItems(userId);

    res.json({ success: true, data: formatCartItems(items) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch cart', details: err.message });
  }
};

// ---------------- ADD ITEM TO CART ----------------
export const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id, quantity = 1 } = req.body;

    if (quantity <= 0) return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });

    const item = await addCartItem(userId, product_id, quantity);
    res.status(201).json({ success: true, message: 'Item added to cart', data: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to add to cart', details: err.message });
  }
};

// ---------------- UPDATE CART ITEM ----------------
export const updateCartItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (quantity <= 0) return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });

    const item = await updateCart(id, quantity);
    res.json({ success: true, message: 'Cart item updated', data: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update cart item', details: err.message });
  }
};

// ---------------- REMOVE CART ITEM ----------------
export const removeCartItem = async (req, res) => {
  try {
    const { id } = req.params;
    await removeCart(id);
    res.json({ success: true, message: 'Item removed from cart' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to remove cart item', details: err.message });
  }
};

// ---------------- GET CART COUNT ----------------
export const getCartCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await fetchCartCount(userId);
    res.json({ success: true, data: { count } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch cart count', details: err.message });
  }
};

// ---------------- GET CART BY SELLER (OPTIONAL) ----------------
export const getCartBySeller = async (req, res) => {
  try {
    const userId = req.user.id;
    const items = await getCartItems(userId);
    const sellerGroups = {};

    items.forEach(item => {
      const sellerId = item.product?.seller_id || 'unknown';
      if (!sellerGroups[sellerId]) sellerGroups[sellerId] = [];
      sellerGroups[sellerId].push({
        id: item.id,
        product_id: item.product_id.id || item.product_id,
        name: item.product?.name || '',
        price: Number(item.product?.price || 0),
        quantity: item.quantity,
        subtotal: Number(item.product?.price || 0) * item.quantity
      });
    });

    res.json({ success: true, data: sellerGroups });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch cart by seller', details: err.message });
  }
};

