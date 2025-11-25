// storeModel.js
import { supabase } from "../config/db.js";

export async function fetchStores({ query = "" } = {}) {
  let storeQuery = supabase
    .from("stores")
    .select("*")
    .ilike("name", `%${query}%`) // case-insensitive partial match

  const { data, error } = await storeQuery.limit(50);

  if (error) throw error;

  return data;
}

