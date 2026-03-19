import type { APIContext } from 'astro';
import { getSupabaseAdmin } from '../../../../../lib/admin/supabase';

export const prerender = false;

export async function POST({ params, request }: APIContext) {
  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing outreach ID' }), {
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
  if (newStatus !== 'skipped') {
    return new Response(
      JSON.stringify({ error: 'Status must be "skipped" (sent is Phase 2)' }),
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

  const { data: updated, error: updateError } = await sb
    .from('outreach_opportunities')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    console.error('[Outreach] Status update error:', updateError.message);
    return new Response(
      JSON.stringify({ error: 'Failed to update outreach opportunity' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!updated) {
    return new Response(
      JSON.stringify({ error: 'Outreach opportunity not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({ outreach: updated }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
