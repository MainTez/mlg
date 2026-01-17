import { createClient } from "@supabase/supabase-js";

let supabaseAdmin = null;

export const getSupabaseAdmin = () => {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  supabaseAdmin = createClient(url, serviceKey, {
    auth: { persistSession: false }
  });

  return supabaseAdmin;
};
