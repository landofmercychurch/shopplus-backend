//orderitemsRoutes.js

import express from 'express';
import { addOrderItem, getOrderItems } from '../controllers/orderItemsController.js';
const router = express.Router();

router.post('/', addOrderItem);
router.get('/:order_id', getOrderItems);

export default router;
