import express from 'express';
import { createPayment, getPaymentByOrder } from '../controllers/paymentsController.js';
const router = express.Router();

router.post('/', createPayment);
router.get('/:order_id', getPaymentByOrder);

export default router;
