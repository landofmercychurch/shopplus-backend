import express from 'express';
import { addReview, getReviewsByProduct } from '../controllers/reviewsController.js';
import { authenticateJWT } from '../middleware/authMiddleware.js';

const router = express.Router();

// -------------------- PUBLIC ROUTES --------------------

// Get all reviews for a specific product
// GET /reviews/product/:productId
router.get('/product/:productId', getReviewsByProduct);

// -------------------- AUTHENTICATED ROUTES --------------------
// Protect all routes below this line
router.use(authenticateJWT);

// Add a review for a product
// POST /reviews
router.post('/', addReview);

export default router;

