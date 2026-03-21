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
  businessmap_card_id: number | null;
  first_seen_at: string;
}

export interface OpportunitySummary {
  total: number;
  new: number;
  seen: number;
  applied: number;
  highMatch: number;
}

export interface OpportunityFilters {
  status?: string;        // 'all' | 'new' | 'seen' | 'applied'
  source?: string;        // 'all' | 'reed' | 'adzuna'
  minScore?: number;      // minimum match score (0-100)
  minRate?: number;       // minimum day rate
  sort?: string;          // 'score' | 'date' | 'rate'
  hideSeen?: boolean;     // hide seen items
}

/**
 * Fetch active job opportunities (excludes aged and removed) with filtering.
 */
export async function getOpportunities(filters: OpportunityFilters = {}): Promise<JobOpportunity[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const sortField = filters.sort === 'date' ? 'date_posted'
    : filters.sort === 'rate' ? 'day_rate_max'
    : 'match_score';

  let query = sb
    .from('job_opportunities')
    .select('*')
    .not('status', 'in', '("aged","removed")')
    .order(sortField, { ascending: false, nullsFirst: false });

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.hideSeen) {
    query = query.neq('status', 'seen');
  }

  if (filters.source && filters.source !== 'all') {
    query = query.eq('source', filters.source);
  }

  if (filters.minScore && filters.minScore > 0) {
    query = query.gte('match_score', filters.minScore);
  }

  if (filters.minRate && filters.minRate > 0) {
    query = query.gte('day_rate_max', filters.minRate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Opportunities] Fetch error:', error.message);
    return [];
  }

  return (data || []) as JobOpportunity[];
}

/** Count by source for display. */
export async function getSourceCounts(): Promise<Record<string, number>> {
  const sb = getSupabaseAdmin();
  if (!sb) return {};

  const { data } = await sb
    .from('job_opportunities')
    .select('source')
    .not('status', 'in', '("aged","removed")');

  if (!data) return {};
  const counts: Record<string, number> = {};
  data.forEach((d) => { counts[d.source] = (counts[d.source] || 0) + 1; });
  return counts;
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
    .not('status', 'in', '("aged","removed")');

  if (error || !data) return { total: 0, new: 0, seen: 0, applied: 0, highMatch: 0 };

  const summary: OpportunitySummary = { total: data.length, new: 0, seen: 0, applied: 0, highMatch: 0 };
  for (const d of data) {
    if (d.status === 'new') summary.new++;
    else if (d.status === 'seen') summary.seen++;
    else if (d.status === 'applied') summary.applied++;
    if ((d.match_score || 0) >= 60) summary.highMatch++;
  }
  return summary;
}

/**
 * Fetch emergency job opportunities (inside IR35 and unknown).
 * Excludes aged and removed. Supports recency filtering.
 * Sorted by match score descending.
 */
export async function getEmergencyOpportunities(
  statusFilter?: string,
  recencyDays?: number,
): Promise<JobOpportunity[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  let query = sb
    .from('job_opportunities')
    .select('*')
    .not('status', 'in', '("aged","removed")')
    .in('ir35_status', ['inside', 'unknown'])
    .order('match_score', { ascending: false, nullsFirst: false });

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  if (recencyDays && recencyDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - recencyDays);
    query = query.gte('date_posted', cutoff.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Opportunities] Emergency fetch error:', error.message);
    return [];
  }

  return (data || []) as JobOpportunity[];
}

/**
 * Get summary counts for the emergency opportunities dashboard (inside IR35 and unknown).
 * Supports recency filtering to match the main query.
 */
export async function getEmergencyOpportunitySummary(
  recencyDays?: number,
): Promise<OpportunitySummary> {
  const sb = getSupabaseAdmin();
  if (!sb) return { total: 0, new: 0, seen: 0, applied: 0, highMatch: 0 };

  let query = sb
    .from('job_opportunities')
    .select('status, match_score, ir35_status')
    .not('status', 'in', '("aged","removed")')
    .in('ir35_status', ['inside', 'unknown']);

  if (recencyDays && recencyDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - recencyDays);
    query = query.gte('date_posted', cutoff.toISOString());
  }

  const { data, error } = await query;

  if (error || !data) return { total: 0, new: 0, seen: 0, applied: 0, highMatch: 0 };

  const summary: OpportunitySummary = { total: data.length, new: 0, seen: 0, applied: 0, highMatch: 0 };
  for (const d of data) {
    if (d.status === 'new') summary.new++;
    else if (d.status === 'seen') summary.seen++;
    else if (d.status === 'applied') summary.applied++;
    if ((d.match_score || 0) >= 60) summary.highMatch++;
  }
  return summary;
}

/**
 * Fetch active outside IR35 opportunities for the partner network view.
 * Excludes aged opportunities, sorted by date posted descending.
 */
export async function getPartnerOpportunities(): Promise<JobOpportunity[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const { data, error } = await sb
    .from('job_opportunities')
    .select('*')
    .not('status', 'in', '("aged","removed")')
    .eq('ir35_status', 'outside')
    .order('date_posted', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('[Opportunities] Partner fetch error:', error.message);
    return [];
  }

  return (data || []) as JobOpportunity[];
}
