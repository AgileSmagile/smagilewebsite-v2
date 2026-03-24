import type { APIContext } from 'astro';
import { getSupabaseAdmin } from '../../../../../lib/admin/supabase';
import { createBoard5Card } from '../../../../../lib/admin/businessmap';
import { jsonOk, jsonError } from '../../../../../lib/admin/api-response';

export const prerender = false;

export async function POST({ params, request }: APIContext) {
  const { id } = params;

  if (!id) {
    return jsonError('Missing opportunity ID');
  }

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const newStatus = body.status;
  const validStatuses = ['applied', 'seen', 'removed'];
  if (!validStatuses.includes(newStatus || '')) {
    return jsonError(`Status must be one of: ${validStatuses.join(', ')}`);
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return jsonError('Database unavailable', 503);
  }

  // Fetch the current opportunity to check existing state
  const { data: existing, error: fetchError } = await sb
    .from('job_opportunities')
    .select('id, title, source, day_rate_min, day_rate_max, agency, end_client, location, ir35_status, url, match_score, businessmap_card_id')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return jsonError('Opportunity not found', 404);
  }

  const updates: Record<string, unknown> = { status: newStatus };
  let businessmapCardId: number | null = existing.businessmap_card_id ?? null;

  // Create a Businessmap card when marking as applied (if not already linked)
  if (newStatus === 'applied' && !existing.businessmap_card_id) {
    const title = `[${existing.source}] ${existing.title}`;

    const descParts: string[] = [];
    if (existing.day_rate_min || existing.day_rate_max) {
      const min = existing.day_rate_min;
      const max = existing.day_rate_max;
      if (min && max && min !== max) {
        descParts.push(`**Day rate:** £${min}-£${max}`);
      } else {
        descParts.push(`**Day rate:** £${min || max}`);
      }
    }
    if (existing.agency) descParts.push(`**Agency:** ${existing.agency}`);
    if (existing.end_client) descParts.push(`**End client:** ${existing.end_client}`);
    if (existing.location) descParts.push(`**Location:** ${existing.location}`);
    if (existing.ir35_status) descParts.push(`**IR35:** ${existing.ir35_status}`);
    if (existing.url) descParts.push(`**Original listing:** ${existing.url}`);
    if (existing.match_score) descParts.push(`**Match score:** ${existing.match_score}%`);

    const description = descParts.join('\n');
    const cardId = await createBoard5Card(title, description);

    if (cardId) {
      updates.businessmap_card_id = cardId;
      businessmapCardId = cardId;
    }
  }

  const { data: updated, error: updateError } = await sb
    .from('job_opportunities')
    .update(updates)
    .eq('id', id)
    .select('id, status, businessmap_card_id')
    .single();

  if (updateError) {
    console.error('[Opportunities] Status update error:', updateError.message);
    return jsonError('Failed to update opportunity', 500);
  }

  return jsonOk({
    opportunity: updated,
    businessmap_card_id: businessmapCardId,
  });
}
