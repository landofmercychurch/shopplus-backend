// src/controllers/cartController.js
import {
  addToCart as addCartItem,
  getCart as getCartItems,
  updateCartItem as updateCart,
  removeCartItem as removeCart,
  getCartCount as fetchCartCount
} from '../models/cartModel.js';

// Get all items in the user's cart
export const getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const items = await getCartItems(userId);

    // Format products if needed (flatten product object)
    const formattedItems = items.map(item => ({
      id: item.id,
      product_id: item.product_id.id || item.product_id, // depends on how your join works
      name: item.product?.name || '',
      price: Number(item.product?.price || 0),
      quantity: item.quantity,
    }));

    res.json(formattedItems || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
};

// Add a product to the cart (increment if exists)
export const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id, quantity = 1 } = req.body;

    const item = await addCartItem(userId, product_id, quantity);
    res.status(201).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
};

// Update quantity of a cart item
export const updateCartItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    const item = await updateCart(id, quantity);
    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update cart item' });
  }
};

// Remove an item from the cart
export const removeCartItem = async (req, res) => {
  try {
    const { id } = req.params;

    await removeCart(id);
    res.json({ message: 'Item removed from cart' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove cart item' });
  }
};

// Get cart item count
export const getCartCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await fetchCartCount(userId);
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch cart count' });
  }
};

