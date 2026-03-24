import type { APIContext } from 'astro';
import { getSupabaseAdmin } from '../../../../../lib/admin/supabase';
import { jsonOk, jsonError } from '../../../../../lib/admin/api-response';

export const prerender = false;

export async function POST({ params, request }: APIContext) {
  const { id } = params;

  if (!id) {
    return jsonError('Missing outreach ID');
  }

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const newStatus = body.status;
  if (newStatus !== 'skipped') {
    return jsonError('Status must be "skipped" (sent is Phase 2)');
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return jsonError('Database unavailable', 503);
  }

  const { data: updated, error: updateError } = await sb
    .from('outreach_opportunities')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, status, updated_at')
    .single();

  if (updateError) {
    console.error('[Outreach] Status update error:', updateError.message);
    return jsonError('Failed to update outreach opportunity', 500);
  }

  if (!updated) {
    return jsonError('Outreach opportunity not found', 404);
  }

  return jsonOk({ outreach: updated });
}
