// src/controllers/campaignController.js
import { supabase } from "../config/db.js";

// -------------------- GET ALL ACTIVE CAMPAIGNS --------------------
export const getAllActiveCampaigns = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error("❌ Failed to fetch campaigns:", err);
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
};

// -------------------- GET CAMPAIGNS BY STORE (protected) --------------------
export const getCampaignsByStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error("❌ Failed to fetch campaigns by store:", err);
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
};

// -------------------- GET CAMPAIGNS BY STORE (public) --------------------
export const getCampaignsByStorePublic = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("store_id", storeId)
      .eq("is_active", true) // only active campaigns for public
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error("❌ Failed to fetch public campaigns by store:", err);
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
};

// -------------------- GET SINGLE CAMPAIGN --------------------
export const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("❌ Failed to fetch campaign:", err);
    res.status(500).json({ error: "Failed to fetch campaign" });
  }
};

// -------------------- CREATE CAMPAIGN --------------------
export const createCampaign = async (req, res) => {
  try {
    const { store_id, name, description, banner_url, discount_percent, start_date, end_date, is_active } = req.body;

    const { data, error } = await supabase
      .from("campaigns")
      .insert([{ store_id, name, description, banner_url, discount_percent, start_date, end_date, is_active }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error("❌ Failed to create campaign:", err);
    res.status(500).json({ error: "Failed to create campaign" });
  }
};

// -------------------- UPDATE CAMPAIGN --------------------
export const updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, banner_url, discount_percent, start_date, end_date, is_active } = req.body;

    const { data, error } = await supabase
      .from("campaigns")
      .update({ name, description, banner_url, discount_percent, start_date, end_date, is_active })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("❌ Failed to update campaign:", err);
    res.status(500).json({ error: "Failed to update campaign" });
  }
};

// -------------------- DELETE CAMPAIGN --------------------
export const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from("campaigns").delete().eq("id", id);

    if (error) throw error;
    res.json({ message: "Campaign deleted successfully" });
  } catch (err) {
    console.error("❌ Failed to delete campaign:", err);
    res.status(500).json({ error: "Failed to delete campaign" });
  }
};

