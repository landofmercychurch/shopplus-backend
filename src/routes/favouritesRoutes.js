import express from 'express';
import { addFavourite, getFavourites, removeFavourite } from '../controllers/favouritesController.js';
const router = express.Router();

router.post('/', addFavourite);                          // Add to wishlist
router.get('/:buyer_id', getFavourites);                 // List wishlist items
router.delete('/:buyer_id/:product_id', removeFavourite); // Remove specific item


export default router;
