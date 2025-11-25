import express from 'express';
import { createShipment, updateShipmentStatus, getShipmentByOrder } from '../controllers/shipmentsController.js';
const router = express.Router();

router.post('/', createShipment);
router.put('/:id', updateShipmentStatus);
router.get('/:order_id', getShipmentByOrder);

export default router;
