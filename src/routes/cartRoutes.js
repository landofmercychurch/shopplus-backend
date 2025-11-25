// src/routes/cartRoutes.js
import express from 'express';
import {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  getCartCount
} from '../controllers/cartController.js'; // only controller imports
import { authenticateJWT } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', authenticateJWT, addToCart);
router.get('/', authenticateJWT, getCart);
router.patch('/:id', authenticateJWT, updateCartItem);
router.delete('/:id', authenticateJWT, removeCartItem);
router.get('/count', authenticateJWT, getCartCount);

export default router;

