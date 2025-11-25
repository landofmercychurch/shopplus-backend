import { supabase } from '.../config/db.js';
import bcrypt from 'bcryptjs';

const users = [
  { full_name: 'Ade Bola', email: 'ade@sellers.com', password: 'password123', role: 'seller', store_name: 'Ade Fashion' },
  { full_name: 'Ngozi Tech', email: 'ngozi@sellers.com', password: 'password123', role: 'seller', store_name: 'Ngozi Gadgets' },
  { full_name: 'Samuel Buyer', email: 'samuel@buyers.com', password: 'password123', role: 'buyer', store_name: null },
];

async function migrateUsers() {
  for (const u of users) {
    try {
      // 1️⃣ Create user in Supabase Auth
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true
      });

      if (authError) {
        console.log(`❌ Error creating ${u.email}:`, authError.message);
        continue;
      }

      // 2️⃣ Create profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .insert([{ id: authUser.id, full_name: u.full_name, role: u.role, store_name: u.store_name }])
        .select()
        .single();

      if (profileError) {
        console.log(`❌ Error creating profile for ${u.email}:`, profileError.message);
        continue;
      }

      console.log(`✅ Migrated user ${u.email}`);
    } catch (err) {
      console.log(`❌ Exception for ${u.email}:`, err.message);
    }
  }

  process.exit();
}

migrateUsers();

