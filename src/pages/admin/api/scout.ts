import type { APIContext } from 'astro';
import { getInsights, addInsight, deleteInsight } from '../../../lib/admin/scout';
import { jsonOk, jsonError } from '../../../lib/admin/api-response';

export const prerender = false;

export async function GET() {
  try {
    const insights = getInsights();
    return jsonOk(insights);
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
    return jsonError('Invalid JSON body');
  }

  const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
  if (!companyName) {
    return jsonError('Company name is required');
  }

  const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : '';
  if (sourceUrl && !sourceUrl.startsWith('https://') && !sourceUrl.startsWith('http://')) {
    return jsonError('Source URL must use http:// or https://', 400);
  }

  try {
    const insight = addInsight({
      sourceUrl,
      selectedText: typeof body.selectedText === 'string' ? body.selectedText.trim() : '',
      companyName,
      notes: typeof body.notes === 'string' ? body.notes.trim() : '',
    });

    return jsonOk(insight, 201);
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
    return jsonError('Invalid JSON body');
  }

  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) {
    return jsonError('Insight ID is required');
  }

  try {
    const deleted = deleteInsight(id);
    if (!deleted) {
      return jsonError('Insight not found', 404);
    }

    return jsonOk({ success: true });
  } catch (err) {
    console.error('[scout] DELETE failed:', err);
    return jsonError('Failed to delete insight. Check server logs for details.', 500);
  }
}
