//backend/routes/shippingRoute.js
import express from "express";
import { calculateShipping } from "../models/shipping/shippingRates.js";

const router = express.Router();

router.post("/calculate", async (req, res) => {
  try {
    const { state, lga, totalWeight, originCoords, destinationCoords } = req.body;

    const fee = await calculateShipping({
      state,
      lga,
      totalWeight,
      originCoords,
      destinationCoords
    });

    res.json({ shippingFee: fee });
  } catch (err) {
    console.error("Shipping calc error:", err);
    res.status(500).json({ error: err.message || "Failed to calculate shipping" });
  }
});

export default router;

