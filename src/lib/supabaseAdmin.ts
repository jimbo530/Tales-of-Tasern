import { createClient } from "@supabase/supabase-js";

// Server-only client with service role key for writing chain data.
// NEVER use NEXT_PUBLIC_ for this — it bypasses RLS.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
