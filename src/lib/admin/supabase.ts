import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let mosaicClient: SupabaseClient | null = null;

/**
 * Server-side Supabase client for admin dashboard queries (smagile DB).
 * Uses the service role key to bypass RLS - acceptable because admin pages
 * are SSR-only and protected by Cloudflare Access. The key never reaches the browser.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
}

/**
 * Server-side Supabase client for Mosaic CV database (separate project).
 * Used by profile matching to read the user's career data from Mosaic.
 */
export function getMosaicSupabase(): SupabaseClient | null {
  if (mosaicClient) return mosaicClient;

  const url = process.env.MOSAIC_SUPABASE_URL;
  const key = process.env.MOSAIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn('[Supabase] Missing MOSAIC_SUPABASE_URL or MOSAIC_SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }

  mosaicClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return mosaicClient;
}
