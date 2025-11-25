import express from 'express';
import {
  addTrackingUpdate,
  getTrackingByOrder,
  getAllTracking,
  deleteTracking
} from '../controllers/trackingController.js';

const router = express.Router();

// Add a new tracking update
router.post('/', addTrackingUpdate);

// Get all tracking updates for a specific order
router.get('/order/:order_id', getTrackingByOrder);

// Admin: get all tracking entries
router.get('/', getAllTracking);

// Delete a tracking record
router.delete('/:id', deleteTracking);

export default router;

