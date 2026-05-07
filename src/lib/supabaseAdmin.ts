import { createClient } from "@supabase/supabase-js";

// Server-only client with service role key for writing chain data.
// NEVER use NEXT_PUBLIC_ for this — it bypasses RLS.
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  console.warn('[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY missing — using anon key (limited permissions)');
}

const _client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/** Server Supabase client. Warns if service role key is missing. */
export const supabaseAdmin = _client;
