// src/routes/cartRoutes.js
import express from 'express';
import {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  getCartCount,
  getCartBySeller
} from '../controllers/cartController.js';
import { authenticateJWT } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get total number of items in cart
router.get('/count', authenticateJWT, getCartCount);

// Get all cart items
router.get('/', authenticateJWT, getCart);

// Get cart items grouped by seller (optional, for multi-seller checkout)
router.get('/byseller', authenticateJWT, getCartBySeller);

// Add a product to cart
router.post('/', authenticateJWT, addToCart);

// Update quantity of a cart item
router.patch('/:id', authenticateJWT, updateCartItem);

// Remove an item from the cart
router.delete('/:id', authenticateJWT, removeCartItem);

export default router;

