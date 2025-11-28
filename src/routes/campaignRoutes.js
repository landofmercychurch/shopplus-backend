import express from 'express';
import { authenticateJWT } from '../middleware/authMiddleware.js';
import {
  getAllActiveCampaigns,
  getCampaignsByStore,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignsByStorePublic, // new function for public campaigns
} from '../controllers/campaignController.js';

const router = express.Router();

// PUBLIC ROUTES

// Get campaigns for a specific store (public, no auth required) – static route first
router.get('/public/store/:storeId', getCampaignsByStorePublic);

// Get single campaign by ID
router.get('/:id', getCampaignById);

// Get all active campaigns
router.get('/', getAllActiveCampaigns);

// =========================
// SELLER / ADMIN ROUTES (requires auth)
// =========================
router.get('/store/:storeId', authenticateJWT, getCampaignsByStore);
router.post('/', authenticateJWT, createCampaign);
router.put('/:id', authenticateJWT, updateCampaign);
router.delete('/:id', authenticateJWT, deleteCampaign);

export default router;

