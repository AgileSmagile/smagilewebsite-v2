import { getSupabaseAdmin } from './supabase';
import { cacheGet, cacheSet } from './cache';

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

export interface CodeHealthSnapshot {
  lines_of_code: number | null;
  sloc: number | null;
  test_count: number | null;
  tests_passing: number | null;
  tests_failing: number | null;
  test_coverage_pct: number | null;
  lint_errors: number | null;
  lint_warnings: number | null;
  vuln_critical: number | null;
  vuln_high: number | null;
  vuln_moderate: number | null;
  build_time_ms: number | null;
  bundle_size_kb: number | null;
  insertions_30d: number | null;
  deletions_30d: number | null;
  files_changed_30d: number | null;
  type_safety_any_count: number | null;
  todo_fixme_count: number | null;
  created_at: string;
  // Detailed audit data (from raw_data JSONB column)
  top_files?: Array<{ path: string; lines: number }>;
  lines_by_directory?: Array<{ directory: string; lines: number }>;
  bloat_files?: Array<{ path: string; lines: number }>;
  todo_hotspots?: Array<{ path: string; count: number }>;
  git_churn?: Array<{ path: string; changes: number }>;
  type_definitions?: Array<{ path: string; count: number }>;
  file_type_breakdown?: Array<{ extension: string; lines: number; files: number }>;
}

export type Trend = 'up' | 'down' | 'flat';

export interface CodeHealthMetrics {
  latest: CodeHealthSnapshot | null;
  previous: CodeHealthSnapshot | null;
  history: CodeHealthSnapshot[];
}

export interface UsageMetrics {
  totalUsers: number;
  dauEstimate: number;
  wauEstimate: number;
  mauEstimate: number;
  subscriptionBreakdown: Record<string, number>;
  totalOutputs: number;
  outputsThisWeek: number;
  failedOutputs: number;
  totalOutputAttempts: number;
}

export interface AiUsageMetrics {
  totalTokens: number;
  uniqueUsers: number;
  avgTokensPerUser: number;
  interactionBreakdown: Record<string, number>;
}

export interface FunnelMetrics {
  totalSignups: number;
  usersWithCv: number;
  usersWithMultipleCvs: number;
  usersWhoExported: number;
}

export interface PipelineStage {
  stageId: string;
  durationMs: number;
  status: string;
}

export interface PipelineRun {
  id: string;
  type: 'document' | 'variant';
  completedAt: string;
  durationMs: number;
  status: string;
  stages: PipelineStage[];
}

export interface PipelineMetrics {
  runs: PipelineRun[];
  percentiles: { p50: number; p85: number; p95: number };
}

export interface MetricsError {
  section: string;
  message: string;
}

export interface ProjectMetrics {
  codeHealth: CodeHealthMetrics | null;
  usage: UsageMetrics | null;
  aiUsage: AiUsageMetrics | null;
  funnel: FunnelMetrics | null;
  pipeline: PipelineMetrics | null;
  errors: MetricsError[];
}

// -------------------------------------------------------------------
// Cache keys & TTLs
// -------------------------------------------------------------------

const CACHE_TTL_CODE_HEALTH = 10 * 60 * 1000; // 10 minutes
const CACHE_TTL_USAGE = 5 * 60 * 1000;         // 5 minutes
const CACHE_TTL_AI = 10 * 60 * 1000;           // 10 minutes
const CACHE_TTL_FUNNEL = 15 * 60 * 1000;       // 15 minutes
const CACHE_TTL_PIPELINE = 10 * 60 * 1000;     // 10 minutes

// -------------------------------------------------------------------
// Code Health
// -------------------------------------------------------------------

/** Merge detailed audit fields from raw_data JSONB into the snapshot. */
function mergeRawData(
  row: (CodeHealthSnapshot & { raw_data?: Record<string, unknown> }) | null,
): CodeHealthSnapshot | null {
  if (!row) return null;
  const raw = row.raw_data;
  if (!raw || typeof raw !== 'object') return row;

  const auditFields = [
    'top_files',
    'lines_by_directory',
    'bloat_files',
    'todo_hotspots',
    'git_churn',
    'type_definitions',
    'file_type_breakdown',
  ] as const;

  for (const field of auditFields) {
    if (Array.isArray(raw[field])) {
      (row as Record<string, unknown>)[field] = raw[field];
    }
  }

  return row;
}

async function fetchCodeHealth(): Promise<CodeHealthMetrics | null> {
  const cached = cacheGet<CodeHealthMetrics>('metrics:code-health');
  if (cached) return cached;

  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const { data, error } = await sb
    .from('code_health_snapshots')
    .select('*, raw_data')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('[Metrics] code_health_snapshots query failed:', error.message);
    return null;
  }

  // History in chronological order (oldest first)
  const history = (data ?? []).map((row) => mergeRawData(row)!).reverse();

  const result: CodeHealthMetrics = {
    latest: mergeRawData(data?.[0] ?? null),
    previous: mergeRawData(data?.[1] ?? null),
    history,
  };

  cacheSet('metrics:code-health', result, CACHE_TTL_CODE_HEALTH);
  return result;
}

// -------------------------------------------------------------------
// Usage Analytics
// -------------------------------------------------------------------

async function fetchUsageMetrics(): Promise<UsageMetrics | null> {
  const cached = cacheGet<UsageMetrics>('metrics:usage');
  if (cached) return cached;

  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // Run all queries in parallel
    const [
      profilesRes,
      subsRes,
      totalDocsRes,
      totalVariantsRes,
      weekDocsRes,
      weekVariantsRes,
      failedDocsRes,
      failedVariantsRes,
      dauDocsRes,
      wauDocsRes,
      mauDocsRes,
    ] = await Promise.all([
      // Total users
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      // Subscription breakdown
      sb.from('subscriptions').select('tier, status'),
      // Total complete outputs (documents + variants)
      sb.from('cv_documents').select('id', { count: 'exact', head: true }).eq('pipeline_status', 'complete'),
      sb.from('cv_variants').select('id', { count: 'exact', head: true }).eq('pipeline_status', 'complete'),
      // Outputs this week
      sb.from('cv_documents').select('id', { count: 'exact', head: true }).eq('pipeline_status', 'complete').gte('created_at', oneWeekAgo),
      sb.from('cv_variants').select('id', { count: 'exact', head: true }).eq('pipeline_status', 'complete').gte('created_at', oneWeekAgo),
      // Failed outputs (docs + variants)
      sb.from('cv_documents').select('id', { count: 'exact', head: true }).eq('pipeline_status', 'failed'),
      sb.from('cv_variants').select('id', { count: 'exact', head: true }).eq('pipeline_status', 'failed'),
      // DAU: distinct users with activity in last 24h (cv_documents as proxy)
      sb.from('cv_documents').select('user_id').gte('created_at', oneDayAgo),
      // WAU
      sb.from('cv_documents').select('user_id').gte('created_at', oneWeekAgo),
      // MAU
      sb.from('cv_documents').select('user_id').gte('created_at', oneMonthAgo),
    ]);

    // Subscription breakdown
    const breakdown: Record<string, number> = {};
    if (subsRes.data) {
      for (const sub of subsRes.data) {
        const key = `${sub.tier} (${sub.status})`;
        breakdown[key] = (breakdown[key] ?? 0) + 1;
      }
    }

    // Distinct active users
    const distinctUsers = (rows: Array<{ user_id: string }> | null) =>
      new Set(rows?.map((r) => r.user_id) ?? []).size;

    const totalComplete = (totalDocsRes.count ?? 0) + (totalVariantsRes.count ?? 0);
    const totalFailed = (failedDocsRes.count ?? 0) + (failedVariantsRes.count ?? 0);

    const result: UsageMetrics = {
      totalUsers: profilesRes.count ?? 0,
      dauEstimate: distinctUsers(dauDocsRes.data),
      wauEstimate: distinctUsers(wauDocsRes.data),
      mauEstimate: distinctUsers(mauDocsRes.data),
      subscriptionBreakdown: breakdown,
      totalOutputs: totalComplete,
      outputsThisWeek: (weekDocsRes.count ?? 0) + (weekVariantsRes.count ?? 0),
      failedOutputs: totalFailed,
      totalOutputAttempts: totalComplete + totalFailed,
    };

    cacheSet('metrics:usage', result, CACHE_TTL_USAGE);
    return result;
  } catch (err) {
    console.error('[Metrics] Usage query failed:', err);
    return null;
  }
}

// -------------------------------------------------------------------
// AI Usage
// -------------------------------------------------------------------

async function fetchAiUsageMetrics(): Promise<AiUsageMetrics | null> {
  const cached = cacheGet<AiUsageMetrics>('metrics:ai-usage');
  if (cached) return cached;

  const sb = getSupabaseAdmin();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from('ai_usage')
      .select('user_id, interaction_type, tokens_used');

    if (error) {
      console.error('[Metrics] ai_usage query failed:', error.message);
      return null;
    }

    if (!data || data.length === 0) {
      const result: AiUsageMetrics = {
        totalTokens: 0,
        uniqueUsers: 0,
        avgTokensPerUser: 0,
        interactionBreakdown: {},
      };
      cacheSet('metrics:ai-usage', result, CACHE_TTL_AI);
      return result;
    }

    let totalTokens = 0;
    const users = new Set<string>();
    const breakdown: Record<string, number> = {};

    for (const row of data) {
      totalTokens += row.tokens_used ?? 0;
      users.add(row.user_id);
      const type = row.interaction_type ?? 'unknown';
      breakdown[type] = (breakdown[type] ?? 0) + (row.tokens_used ?? 0);
    }

    const result: AiUsageMetrics = {
      totalTokens,
      uniqueUsers: users.size,
      avgTokensPerUser: users.size > 0 ? Math.round(totalTokens / users.size) : 0,
      interactionBreakdown: breakdown,
    };

    cacheSet('metrics:ai-usage', result, CACHE_TTL_AI);
    return result;
  } catch (err) {
    console.error('[Metrics] AI usage query failed:', err);
    return null;
  }
}

// -------------------------------------------------------------------
// Funnel
// -------------------------------------------------------------------

async function fetchFunnelMetrics(): Promise<FunnelMetrics | null> {
  const cached = cacheGet<FunnelMetrics>('metrics:funnel');
  if (cached) return cached;

  const sb = getSupabaseAdmin();
  if (!sb) return null;

  try {
    const [profilesRes, docsRes] = await Promise.all([
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      sb.from('cv_documents').select('user_id, file_url'),
    ]);

    const totalSignups = profilesRes.count ?? 0;

    // Group documents by user
    const userDocs = new Map<string, Array<{ file_url: string | null }>>();
    for (const doc of docsRes.data ?? []) {
      const existing = userDocs.get(doc.user_id) ?? [];
      existing.push({ file_url: doc.file_url });
      userDocs.set(doc.user_id, existing);
    }

    let usersWithCv = 0;
    let usersWithMultipleCvs = 0;
    let usersWhoExported = 0;

    for (const [, docs] of userDocs) {
      usersWithCv++;
      if (docs.length >= 2) usersWithMultipleCvs++;
      if (docs.some((d) => d.file_url)) usersWhoExported++;
    }

    const result: FunnelMetrics = {
      totalSignups,
      usersWithCv,
      usersWithMultipleCvs,
      usersWhoExported,
    };

    cacheSet('metrics:funnel', result, CACHE_TTL_FUNNEL);
    return result;
  } catch (err) {
    console.error('[Metrics] Funnel query failed:', err);
    return null;
  }
}

// -------------------------------------------------------------------
// Pipeline Performance
// -------------------------------------------------------------------

/** Compute a percentile value from a sorted array of numbers. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

export async function fetchPipelineMetrics(): Promise<PipelineMetrics | null> {
  const cached = cacheGet<PipelineMetrics>('metrics:pipeline');
  if (cached) return cached;

  const sb = getSupabaseAdmin();
  if (!sb) return null;

  try {
    // Fetch documents and variants with pipeline timing
    const [docsRes, variantsRes] = await Promise.all([
      sb
        .from('cv_documents')
        .select('id, pipeline_started_at, pipeline_completed_at, pipeline_duration_ms, pipeline_status, created_at, config')
        .not('pipeline_duration_ms', 'is', null),
      sb
        .from('cv_variants')
        .select('id, document_id, pipeline_started_at, pipeline_completed_at, pipeline_duration_ms, pipeline_status, created_at')
        .not('pipeline_duration_ms', 'is', null),
    ]);

    if (docsRes.error) {
      console.error('[Metrics] pipeline cv_documents query failed:', docsRes.error.message);
      return null;
    }
    if (variantsRes.error) {
      console.error('[Metrics] pipeline cv_variants query failed:', variantsRes.error.message);
      return null;
    }

    const docs = docsRes.data ?? [];
    const variants = variantsRes.data ?? [];

    // Collect all IDs for stage lookup
    const docIds = docs.map((d) => d.id);
    const variantIds = variants.map((v) => v.id);

    // Fetch stage executions for all relevant runs
    let stagesByDoc = new Map<string, PipelineStage[]>();
    let stagesByVariant = new Map<string, PipelineStage[]>();

    if (docIds.length > 0 || variantIds.length > 0) {
      const stageQueries: Promise<void>[] = [];

      if (docIds.length > 0) {
        stageQueries.push(
          sb
            .from('pipeline_stage_executions')
            .select('document_id, stage_id, duration_ms, status')
            .in('document_id', docIds)
            .then(({ data, error }) => {
              if (error) {
                console.error('[Metrics] pipeline stages (docs) query failed:', error.message);
                return;
              }
              for (const row of data ?? []) {
                const key = row.document_id as string;
                const existing = stagesByDoc.get(key) ?? [];
                existing.push({
                  stageId: row.stage_id,
                  durationMs: row.duration_ms ?? 0,
                  status: row.status,
                });
                stagesByDoc.set(key, existing);
              }
            }),
        );
      }

      if (variantIds.length > 0) {
        stageQueries.push(
          sb
            .from('pipeline_stage_executions')
            .select('variant_id, stage_id, duration_ms, status')
            .in('variant_id', variantIds)
            .then(({ data, error }) => {
              if (error) {
                console.error('[Metrics] pipeline stages (variants) query failed:', error.message);
                return;
              }
              for (const row of data ?? []) {
                const key = row.variant_id as string;
                const existing = stagesByVariant.get(key) ?? [];
                existing.push({
                  stageId: row.stage_id,
                  durationMs: row.duration_ms ?? 0,
                  status: row.status,
                });
                stagesByVariant.set(key, existing);
              }
            }),
        );
      }

      await Promise.all(stageQueries);
    }

    // Build pipeline runs
    const runs: PipelineRun[] = [];

    for (const doc of docs) {
      runs.push({
        id: doc.id,
        type: 'document',
        completedAt: doc.pipeline_completed_at ?? doc.created_at,
        durationMs: doc.pipeline_duration_ms,
        status: doc.pipeline_status ?? 'unknown',
        stages: stagesByDoc.get(doc.id) ?? [],
      });
    }

    for (const variant of variants) {
      runs.push({
        id: variant.id,
        type: 'variant',
        completedAt: variant.pipeline_completed_at ?? variant.created_at,
        durationMs: variant.pipeline_duration_ms,
        status: variant.pipeline_status ?? 'unknown',
        stages: stagesByVariant.get(variant.id) ?? [],
      });
    }

    // Sort by completion date ascending
    runs.sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());

    // Compute percentiles from durations
    const durations = runs.map((r) => r.durationMs).sort((a, b) => a - b);
    const percentiles = {
      p50: percentile(durations, 50),
      p85: percentile(durations, 85),
      p95: percentile(durations, 95),
    };

    const result: PipelineMetrics = { runs, percentiles };
    cacheSet('metrics:pipeline', result, CACHE_TTL_PIPELINE);
    return result;
  } catch (err) {
    console.error('[Metrics] Pipeline query failed:', err);
    return null;
  }
}

// -------------------------------------------------------------------
// Public: fetch all metrics for Mosaic CV
// -------------------------------------------------------------------

export async function getMosaicMetrics(): Promise<ProjectMetrics> {
  const errors: MetricsError[] = [];

  const [codeHealth, usage, aiUsage, funnel, pipeline] = await Promise.all([
    fetchCodeHealth().catch((err) => {
      errors.push({ section: 'Code Health', message: String(err) });
      return null;
    }),
    fetchUsageMetrics().catch((err) => {
      errors.push({ section: 'Usage', message: String(err) });
      return null;
    }),
    fetchAiUsageMetrics().catch((err) => {
      errors.push({ section: 'AI Usage', message: String(err) });
      return null;
    }),
    fetchFunnelMetrics().catch((err) => {
      errors.push({ section: 'Funnel', message: String(err) });
      return null;
    }),
    fetchPipelineMetrics().catch((err) => {
      errors.push({ section: 'Pipeline', message: String(err) });
      return null;
    }),
  ]);

  return { codeHealth, usage, aiUsage, funnel, pipeline, errors };
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

/**
 * Compare two numeric values and return a trend direction.
 * "up" means the latest is higher, "down" means lower, "flat" if equal or missing.
 * For metrics where lower is better (e.g. lint errors, vulnerabilities),
 * the caller should invert the meaning in the UI.
 */
export function getTrend(latest: number | null, previous: number | null): Trend {
  if (latest === null || previous === null) return 'flat';
  if (latest > previous) return 'up';
  if (latest < previous) return 'down';
  return 'flat';
}

/** Format a number with k/M suffixes for display. */
export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '--';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('en-GB');
}

/** Format milliseconds as a human-readable duration. */
export function formatDuration(ms: number | null): string {
  if (ms === null) return '--';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Format a percentage. */
export function formatPct(value: number | null): string {
  if (value === null) return '--';
  return `${value.toFixed(1)}%`;
}

/** Format a date relative to now. */
export function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Strip leading path noise to show relative path from src/. */
export function formatFilePath(fullPath: string): string {
  const srcIdx = fullPath.indexOf('src/');
  if (srcIdx !== -1) return fullPath.slice(srcIdx);
  // If no src/ found, strip common prefixes
  return fullPath.replace(/^.*?(?=(?:app|pages|components|lib|utils|hooks)\/)/, '');
}

/** Estimate cost from token count (Claude Sonnet pricing approximation). */
export function estimateAiCost(tokens: number): string {
  // Rough estimate: ~$3 per 1M input tokens, ~$15 per 1M output tokens
  // Using a blended ~$8 per 1M tokens as a rough average
  const cost = (tokens / 1_000_000) * 8;
  if (cost < 0.01) return '<$0.01';
  return `$${cost.toFixed(2)}`;
}

/**
 * Extract a numeric field from a history array for sparkline display.
 * Filters out null values and returns numbers oldest-first.
 */
export function extractSparkline(
  history: CodeHealthSnapshot[],
  field: keyof CodeHealthSnapshot,
): number[] {
  return history
    .map((snap) => snap[field])
    .filter((v): v is number => typeof v === 'number');
}
