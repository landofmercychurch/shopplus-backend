//src/models/notificationsModel.js
import { supabase } from '../config/db.js';

const TABLE = 'notifications';

// Create a notification
export const createNotification = async ({ user_id, message, type = 'general' }) => {
  const { data, error } = await supabase
    .from(TABLE)
    .insert([{ user_id, message, type }])
    .select();

  if (error) throw error;
  return data[0];
};

// Get all notifications for a user
export const getNotificationsByUser = async (user_id) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

// Mark one notification as read
export const markNotificationAsRead = async (id) => {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ is_read: true })
    .eq('id', id)
    .select();

  if (error) throw error;
  return data[0];
};

// Mark all notifications as read for a user
export const markAllNotificationsAsRead = async (user_id) => {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ is_read: true })
    .eq('user_id', user_id)
    .select();

  if (error) throw error;
  return data;
};

