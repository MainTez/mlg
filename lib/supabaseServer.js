import { createClient } from "@supabase/supabase-js";

export const getSupabaseServer = () => {
  const url = process.env.SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY.");
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false }
  });
};

const ALLOWED_EMAILS = new Set([
  "danilebnen@gmail.com",
  "hadilebnen@gmail.com",
  "1nd.brahimi09@gmail.com",
  "felx.trad@gmail.com",
  "johanziolkowski@gmail.com"
]);

export const requireAuth = async (request) => {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return { ok: false, error: "Missing authorization token." };
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return { ok: false, error: "Unauthorized." };
  }

  const email = data.user.email?.toLowerCase() || "";
  if (!ALLOWED_EMAILS.has(email)) {
    return { ok: false, error: "Access denied." };
  }

  return { ok: true, user: data.user };
};
