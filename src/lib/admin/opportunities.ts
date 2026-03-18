import { getSupabaseAdmin } from './supabase';

export interface JobOpportunity {
  id: string;
  source: string;
  source_id: string;
  title: string;
  description_snippet: string | null;
  day_rate_min: number | null;
  day_rate_max: number | null;
  agency: string | null;
  end_client: string | null;
  location: string | null;
  ir35_status: string;
  date_posted: string | null;
  url: string;
  status: string;
  match_score: number | null;
  match_reasons: string[] | null;
  first_seen_at: string;
}

export interface OpportunitySummary {
  total: number;
  new: number;
  seen: number;
  applied: number;
  highMatch: number;
}

/**
 * Fetch active job opportunities (excludes aged), sorted by match score descending.
 */
export async function getOpportunities(statusFilter?: string): Promise<JobOpportunity[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  let query = sb
    .from('job_opportunities')
    .select('*')
    .neq('status', 'aged')
    .order('match_score', { ascending: false, nullsFirst: false });

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Opportunities] Fetch error:', error.message);
    return [];
  }

  return (data || []) as JobOpportunity[];
}

/**
 * Get summary counts for the opportunities dashboard.
 */
export async function getOpportunitySummary(): Promise<OpportunitySummary> {
  const sb = getSupabaseAdmin();
  if (!sb) return { total: 0, new: 0, seen: 0, applied: 0, highMatch: 0 };

  const { data, error } = await sb
    .from('job_opportunities')
    .select('status, match_score')
    .neq('status', 'aged');

  if (error || !data) return { total: 0, new: 0, seen: 0, applied: 0, highMatch: 0 };

  return {
    total: data.length,
    new: data.filter((d) => d.status === 'new').length,
    seen: data.filter((d) => d.status === 'seen').length,
    applied: data.filter((d) => d.status === 'applied').length,
    highMatch: data.filter((d) => (d.match_score || 0) >= 60).length,
  };
}
