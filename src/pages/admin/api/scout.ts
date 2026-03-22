import type { APIContext } from 'astro';
import { getInsights, addInsight, deleteInsight } from '../../../lib/admin/scout';

export const prerender = false;

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: JSON_HEADERS,
  });
}

export async function GET() {
  try {
    const insights = getInsights();
    return new Response(JSON.stringify(insights), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (err) {
    console.error('[scout] GET failed:', err);
    return jsonError('Failed to read insights', 500);
  }
}

export async function POST({ request }: APIContext) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
  if (!companyName) {
    return jsonError('Company name is required', 400);
  }

  try {
    const insight = addInsight({
      sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : '',
      selectedText: typeof body.selectedText === 'string' ? body.selectedText.trim() : '',
      companyName,
      notes: typeof body.notes === 'string' ? body.notes.trim() : '',
    });

    return new Response(JSON.stringify(insight), {
      status: 201,
      headers: JSON_HEADERS,
    });
  } catch (err) {
    console.error('[scout] POST failed:', err);
    return jsonError('Failed to save insight. Check server logs for details.', 500);
  }
}

export async function DELETE({ request }: APIContext) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) {
    return jsonError('Insight ID is required', 400);
  }

  try {
    const deleted = deleteInsight(id);
    if (!deleted) {
      return jsonError('Insight not found', 404);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (err) {
    console.error('[scout] DELETE failed:', err);
    return jsonError('Failed to delete insight. Check server logs for details.', 500);
  }
}
