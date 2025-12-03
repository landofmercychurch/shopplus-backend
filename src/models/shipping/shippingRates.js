// backend/models/shipping/shippingRates.js
import OpenRouteService from 'openrouteservice';

const orsClient = new OpenRouteService({ api_key: process.env.ORS_API_KEY });

// ----------------------
// Base LGA Shipping Rates
// ----------------------
export const shippingRates = {
  "Lagos": {
    "Agege": { zone: "A", basePrice: 800 },
    "Ajeromi-Ifelodun": { zone: "A", basePrice: 800 },
    "Alimosho": { zone: "B", basePrice: 1400 },
    "Amuwo-Odofin": { zone: "B", basePrice: 1400 },
    "Apapa": { zone: "B", basePrice: 1200 },
    "Badagry": { zone: "C", basePrice: 2000 },
    "Epe": { zone: "C", basePrice: 2200 },
    "Eti-Osa": { zone: "A", basePrice: 1000 },
    "Ibeju-Lekki": { zone: "C", basePrice: 2500 },
    "Ifako-Ijaiye": { zone: "B", basePrice: 1300 },
    "Ikeja": { zone: "A", basePrice: 900 },
    "Ikorodu": { zone: "C", basePrice: 2100 },
    "Kosofe": { zone: "B", basePrice: 1300 },
    "Lagos Island": { zone: "A", basePrice: 900 },
    "Lagos Mainland": { zone: "A", basePrice: 900 },
    "Mushin": { zone: "B", basePrice: 1200 },
    "Ojo": { zone: "C", basePrice: 2000 },
    "Oshodi-Isolo": { zone: "B", basePrice: 1300 },
    "Shomolu": { zone: "B", basePrice: 1200 },
    "Surulere": { zone: "B", basePrice: 1200 },
  }
};

// ----------------------
// Weight Surcharge Rules
// ----------------------
export const weightSurcharge = [
  { min: 0, max: 5, surcharge: 0 },     // up to 5kg, no extra
  { min: 5, max: 10, surcharge: 500 },  // 5kg-10kg, +₦500
  { min: 10, max: 20, surcharge: 1000 }, // 10kg-20kg, +₦1000
  { min: 20, max: Infinity, surcharge: 2000 } // above 20kg, +₦2000
];

// ----------------------
// Calculate Distance using ORS
// ----------------------
export async function getDistanceKM(originCoords, destinationCoords) {
  try {
    const response = await orsClient.directions({
      coordinates: [originCoords, destinationCoords],
      profile: 'driving-car',
      format: 'json'
    });
    const distanceMeters = response.routes[0].summary.distance;
    return distanceMeters / 1000; // km
  } catch (err) {
    console.error('❌ ORS distance calculation failed:', err);
    return null; // fallback
  }
}

// ----------------------
// Calculate Final Shipping Fee
// ----------------------
export async function calculateShipping({ state, lga, totalWeight, originCoords, destinationCoords }) {
  // 1️⃣ Get base price
  const stateRates = shippingRates[state];
  if (!stateRates) throw new Error(`Shipping not supported for state: ${state}`);

  const lgaRate = stateRates[lga];
  if (!lgaRate) throw new Error(`Shipping not supported for LGA: ${lga}`);

  let fee = lgaRate.basePrice;

  // 2️⃣ Add weight surcharge
  const weightRule = weightSurcharge.find(rule => totalWeight > rule.min && totalWeight <= rule.max);
  if (weightRule) fee += weightRule.surcharge;

  // 3️⃣ Add distance-based fee (optional)
  if (originCoords && destinationCoords) {
    const distanceKm = await getDistanceKM(originCoords, destinationCoords);
    if (distanceKm) {
      const distanceFee = distanceKm * 50; // ₦50 per km, adjustable
      fee += distanceFee;
    }
  }

  return Math.round(fee);
}

