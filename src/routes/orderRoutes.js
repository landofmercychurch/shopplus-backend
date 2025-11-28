//routes/orderRoutes.js
import express from 'express';
import {
  createOrder,
  getAllOrders,
  getOrderById,
  getOrdersByBuyer,
  getOrdersBySeller,
  getOrdersForLoggedInBuyer,
  updateOrderStatus,
  trackOrder,
  deleteOrder,
  canReviewProduct,
  cancelOrder
} from '../controllers/orderController.js';
import { authenticateJWT } from '../middleware/authMiddleware.js';

const router = express.Router();

// ---------------- CREATE ORDER ----------------
router.post('/', authenticateJWT, createOrder);

// ---------------- GET ORDERS ----------------
// Admin: get all orders
router.get('/', getAllOrders);

// Logged-in buyer: get own orders
router.get('/buyer/me', authenticateJWT, getOrdersForLoggedInBuyer);

// Get orders by specific buyer (admin only or for analytics)
router.get('/buyer/:buyer_id', getOrdersByBuyer);

// Get orders by seller
router.get('/seller/:seller_id', getOrdersBySeller);

// Get single order by ID
router.get('/:id', getOrderById);

// ---------------- UPDATE / CANCEL ----------------
router.put('/:id/status', authenticateJWT, updateOrderStatus);
router.patch('/:id/cancel', authenticateJWT, cancelOrder);

// ---------------- TRACK / DELETE ----------------
router.get('/track/:tracking_number', trackOrder);
router.delete('/:id', authenticateJWT, deleteOrder);

// ---------------- REVIEW ----------------
router.get('/can-review/:productId', canReviewProduct);

export default router;

