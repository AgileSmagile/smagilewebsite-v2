import type { APIContext } from 'astro';
import { getSupabaseAdmin } from '../../../../../lib/admin/supabase';
import { createBoard5Card } from '../../../../../lib/admin/businessmap';

export const prerender = false;

export async function POST({ params, request }: APIContext) {
  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing opportunity ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const newStatus = body.status;
  if (newStatus !== 'applied' && newStatus !== 'seen') {
    return new Response(
      JSON.stringify({ error: 'Status must be "applied" or "seen"' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return new Response(
      JSON.stringify({ error: 'Database unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Fetch the current opportunity to check existing state
  const { data: existing, error: fetchError } = await sb
    .from('job_opportunities')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return new Response(
      JSON.stringify({ error: 'Opportunity not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    );
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
    .select('*')
    .single();

  if (updateError) {
    console.error('[Opportunities] Status update error:', updateError.message);
    return new Response(
      JSON.stringify({ error: 'Failed to update opportunity' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({
      opportunity: updated,
      businessmap_card_id: businessmapCardId,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
