import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// 🧩 Load environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 🛑 Check if variables exist
if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ Missing Supabase environment variables.");
  console.error("Check your .env file and restart the server.");
  process.exit(1);
}

// 🕒 Custom fetch wrapper with 30s timeout and 1 automatic retry
const customFetch = async (url, options) => {
  const fetchWithTimeout = (timeout = 30000) =>
    Promise.race([
      fetch(url, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeout)
      ),
    ]);

  try {
    return await fetchWithTimeout();
  } catch (err) {
    console.warn("⚠️ Fetch failed, retrying once...", err.message);
    // Retry after 3 seconds
    await new Promise((r) => setTimeout(r, 3000));
    return await fetchWithTimeout();
  }
};

// 🧠 Create Supabase client with custom fetch
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false, // ✅ avoid session conflicts on server
    autoRefreshToken: false,
  },
  global: {
    fetch: customFetch,
  },
});

console.log("✅ Supabase client connected successfully (with 30s timeout & retry)");

export default supabase;

