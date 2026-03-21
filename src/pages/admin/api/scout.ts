import type { APIContext } from 'astro';
import { getInsights, addInsight, deleteInsight } from '../../../lib/admin/scout';

export const prerender = false;

export async function GET() {
  const insights = getInsights();

  return new Response(JSON.stringify(insights), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST({ request }: APIContext) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
  if (!companyName) {
    return new Response(
      JSON.stringify({ error: 'Company name is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const insight = addInsight({
    sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : '',
    selectedText: typeof body.selectedText === 'string' ? body.selectedText.trim() : '',
    companyName,
    notes: typeof body.notes === 'string' ? body.notes.trim() : '',
  });

  return new Response(JSON.stringify(insight), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function DELETE({ request }: APIContext) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Insight ID is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const deleted = deleteInsight(id);
  if (!deleted) {
    return new Response(
      JSON.stringify({ error: 'Insight not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
