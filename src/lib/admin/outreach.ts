import { getSupabaseAdmin } from './supabase';

export interface OutreachOpportunity {
  id: string;
  job_opportunity_id: string;
  trigger_type: 'new_role' | 'stale_role' | 'closed_role';
  target_name: string;
  target_type: 'agency' | 'end_client';
  suggested_subject: string;
  suggested_body: string;
  status: 'new' | 'sent' | 'skipped';
  created_at: string;
  updated_at: string;
  // Joined from job_opportunities
  job_title: string | null;
  job_day_rate_min: number | null;
  job_day_rate_max: number | null;
  job_location: string | null;
  job_url: string | null;
  job_agency: string | null;
  job_end_client: string | null;
  job_date_posted: string | null;
}

export interface OutreachSummary {
  total: number;
  new: number;
  sent: number;
  skipped: number;
  byTrigger: {
    new_role: number;
    stale_role: number;
    closed_role: number;
  };
}

/**
 * Fetch outreach opportunities with optional status and trigger filters.
 * Joins to job_opportunities for context.
 */
export async function getOutreachOpportunities(
  statusFilter?: string,
  triggerFilter?: string,
): Promise<OutreachOpportunity[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  let query = sb
    .from('outreach_opportunities')
    .select(`
      id,
      job_opportunity_id,
      trigger_type,
      target_name,
      target_type,
      suggested_subject,
      suggested_body,
      status,
      created_at,
      updated_at,
      job_opportunities (
        title,
        day_rate_min,
        day_rate_max,
        location,
        url,
        agency,
        end_client,
        date_posted
      )
    `)
    .order('created_at', { ascending: false });

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  if (triggerFilter && triggerFilter !== 'all') {
    query = query.eq('trigger_type', triggerFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Outreach] Fetch error:', error.message);
    return [];
  }

  if (!data) return [];

  // Flatten the joined data
  return data.map((row: any) => {
    const job = row.job_opportunities;
    return {
      id: row.id,
      job_opportunity_id: row.job_opportunity_id,
      trigger_type: row.trigger_type,
      target_name: row.target_name,
      target_type: row.target_type,
      suggested_subject: row.suggested_subject,
      suggested_body: row.suggested_body,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      job_title: job?.title ?? null,
      job_day_rate_min: job?.day_rate_min ?? null,
      job_day_rate_max: job?.day_rate_max ?? null,
      job_location: job?.location ?? null,
      job_url: job?.url ?? null,
      job_agency: job?.agency ?? null,
      job_end_client: job?.end_client ?? null,
      job_date_posted: job?.date_posted ?? null,
    };
  }) as OutreachOpportunity[];
}

/**
 * Summary counts by status and trigger type for KPIs.
 */
export async function getOutreachSummary(): Promise<OutreachSummary> {
  const empty: OutreachSummary = {
    total: 0,
    new: 0,
    sent: 0,
    skipped: 0,
    byTrigger: { new_role: 0, stale_role: 0, closed_role: 0 },
  };

  const sb = getSupabaseAdmin();
  if (!sb) return empty;

  const { data, error } = await sb
    .from('outreach_opportunities')
    .select('status, trigger_type');

  if (error || !data) return empty;

  return {
    total: data.length,
    new: data.filter((d) => d.status === 'new').length,
    sent: data.filter((d) => d.status === 'sent').length,
    skipped: data.filter((d) => d.status === 'skipped').length,
    byTrigger: {
      new_role: data.filter((d) => d.trigger_type === 'new_role').length,
      stale_role: data.filter((d) => d.trigger_type === 'stale_role').length,
      closed_role: data.filter((d) => d.trigger_type === 'closed_role').length,
    },
  };
}
