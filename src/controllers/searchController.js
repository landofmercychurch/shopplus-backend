// src/controllers/searchController.js
import { fetchProducts } from "../models/productModel.js";
import { fetchStores } from "../models/storeModel.js";
import { fetchCampaigns } from "../models/campaignModel.js";

/**
 * Search across products, stores, and campaigns.
 */
export const searchAll = async (req, res) => {
  const { query = "", category, minPrice, maxPrice, rating, brand } = req.query;

  try {
    // -------------------- PRODUCTS --------------------
    const products = await fetchProducts({ query, category, minPrice, maxPrice, rating, brand });

    // -------------------- STORES --------------------
    const stores = await fetchStores({ query });

    // -------------------- CAMPAIGNS --------------------
    const campaigns = await fetchCampaigns({ query });

    // -------------------- RESPONSE --------------------
    return res.json({
      success: true,
      products,
      stores,
      campaigns,
    });
  } catch (error) {
    console.error("Search Error:", error);
    return res.status(500).json({ success: false, error: error.message || "Server error" });
  }
};

