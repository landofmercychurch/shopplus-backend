import express from 'express';
import { authenticateJWT } from '../../middleware/authMiddleware.js';
import {
  getBuyerAddresses,
  addBuyerAddress,
  updateBuyerAddress,
  deleteBuyerAddress,
  setDefaultAddress
} from '../../controllers/buyer/buyerMetadataController.js';

const router = express.Router();

// ============================================================
// BUYER METADATA / ADDRESSES ROUTES
// ============================================================
router.use(authenticateJWT); // protect all routes

router.get('/', getBuyerAddresses);                  // List all addresses
router.post('/', addBuyerAddress);                  // Add new address
router.put('/:id', updateBuyerAddress);             // Update existing address
router.delete('/:id', deleteBuyerAddress);          // Delete address
router.patch('/:id/default', setDefaultAddress);    // Set default address

export default router;