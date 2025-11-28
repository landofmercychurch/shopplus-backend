// src/controllers/productController.js
import { supabase } from "../config/db.js";

// ---------------- CREATE PRODUCT ----------------
export const createProduct = async (req, res) => {
  try {
    const { name, description, category, price, stock, image_url, status, campaign_id } = req.body;

    if (!price) return res.status(400).json({ error: "Price is required" });

    // Get store_id for the authenticated user
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id")
      .eq("user_id", req.user.id)
      .single();

    if (storeError || !store) return res.status(400).json({ error: "Store not found for this user" });

    let newProduct = {
      store_id: store.id,
      name,
      description,
      category,
      price: Number(price),
      stock: stock || 0,
      image_url: image_url || null,
      status: status || "active",
      campaign_id: campaign_id || null,
    };

    // Handle campaign discount
    if (campaign_id) {
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .select("id, discount_percent, name, is_active, start_date, end_date")
        .eq("id", campaign_id)
        .single();

      if (campaignError || !campaign) throw new Error("Invalid campaign");

      const now = new Date();
      if (!campaign.is_active || now < new Date(campaign.start_date) || now > new Date(campaign.end_date)) {
        throw new Error("Campaign not active");
      }

      const discountAmount = (Number(price) * campaign.discount_percent) / 100;
      newProduct = {
        ...newProduct,
        campaign_name: campaign.name,
        discount: campaign.discount_percent,
        old_price: Number(price),
        price: Number(price) - discountAmount,
      };
    }

    const { data, error } = await supabase
      .from("products")
      .insert([newProduct])
      .select("*");

    if (error) throw error;
    res.status(201).json(data[0]);

  } catch (err) {
    console.error("❌ Create product error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ---------------- UPDATE PRODUCT ----------------
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, price, stock, image_url, status, campaign_id } = req.body;

    if (!price) return res.status(400).json({ error: "Price is required" });

    let updatedFields = { name, description, category, price: Number(price), stock, image_url, status };

    // Handle campaign updates
    if (campaign_id) {
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .select("id, discount_percent, name, is_active, start_date, end_date")
        .eq("id", campaign_id)
        .single();

      if (campaignError || !campaign) return res.status(400).json({ error: "Invalid campaign selected." });

      const now = new Date();
      if (!campaign.is_active || now < new Date(campaign.start_date) || now > new Date(campaign.end_date)) {
        return res.status(400).json({ error: "This campaign is not active." });
      }

      const discountAmount = (Number(price) * campaign.discount_percent) / 100;
      updatedFields = {
        ...updatedFields,
        campaign_id,
        campaign_name: campaign.name,
        discount: campaign.discount_percent,
        old_price: Number(price),
        price: Number(price) - discountAmount,
      };
    } else {
      updatedFields = {
        ...updatedFields,
        campaign_id: null,
        campaign_name: null,
        discount: 0,
        old_price: null,
      };
    }

    const { data, error } = await supabase
      .from("products")
      .update(updatedFields)
      .eq("id", id)
      .select("*");

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: "Product not found or update failed" });

    res.status(200).json(data[0]);

  } catch (err) {
    console.error("❌ Update product error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ---------------- DELETE PRODUCT ----------------
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;

    res.status(200).json({ message: "Product deleted successfully" });

  } catch (err) {
    console.error("❌ Delete product error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ---------------- GET SINGLE PRODUCT ----------------
export const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
    if (error) throw error;

    res.status(200).json({
      ...data,
      price: Number(data.price),
      discount: Number(data.discount),
      old_price: data.old_price ? Number(data.old_price) : null,
      rating: Number(data.rating),
    });

  } catch (err) {
    console.error("❌ Get product error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ---------------- GET ALL PRODUCTS ----------------
export const getAllProducts = async (req, res) => {
  try {
    const { data, error } = await supabase.from("products").select("*");
    if (error) throw error;

    const products = data.map(p => ({
      ...p,
      price: Number(p.price),
      discount: Number(p.discount),
      old_price: p.old_price ? Number(p.old_price) : null,
      rating: Number(p.rating),
    }));

    res.status(200).json(products);

  } catch (err) {
    console.error("❌ Get all products error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ---------------- GET PRODUCTS BY STORE ----------------
export const getProductsByStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { data, error } = await supabase.from("products").select("*").eq("store_id", storeId);
    if (error) throw error;

    const products = data.map(p => ({
      ...p,
      price: Number(p.price),
      discount: Number(p.discount),
      old_price: p.old_price ? Number(p.old_price) : null,
      rating: Number(p.rating),
    }));

    res.status(200).json(products);

  } catch (err) {
    console.error("❌ Get products by store error:", err);
    res.status(500).json({ error: err.message });
  }
};

