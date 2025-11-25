import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const run = async () => {
  console.log("Testing Supabase Admin API...");

  const { data, error } = await supabase.auth.admin.createUser({
    email: "admin-test@example.com",
    password: "password123",
  });

  if (error) {
    console.error("❌ Error:", error);
  } else {
    console.log("✅ Success:", data);
  }
};

run();

