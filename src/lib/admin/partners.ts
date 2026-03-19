import { getSupabaseAdmin } from './supabase';

export interface PartnerProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  location: string | null;
  day_rate_min: number | null;
  day_rate_max: number | null;
  ir35_preference: string;
  availability: string;
  availability_from: string | null;
  skills: string[] | null;
  role_titles: string[] | null;
  bio: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all active partner profiles, sorted by name.
 */
export async function getPartners(): Promise<PartnerProfile[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const { data, error } = await sb
    .from('partner_profiles')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('[Partners] Fetch error:', error.message);
    return [];
  }

  return (data || []) as PartnerProfile[];
}

/**
 * Get count of active partners for dashboard KPIs.
 */
export async function getPartnerCount(): Promise<number> {
  const sb = getSupabaseAdmin();
  if (!sb) return 0;

  const { count, error } = await sb
    .from('partner_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  if (error) {
    console.error('[Partners] Count error:', error.message);
    return 0;
  }

  return count || 0;
}
