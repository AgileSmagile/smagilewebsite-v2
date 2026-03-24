import type { APIContext } from 'astro';
import { createOutreachTemplate } from '../../../../lib/admin/outreach-templates';

export const prerender = false;

export async function POST({ request }: APIContext) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { sector, sector_label, touch_number, touch_label, subject, body: templateBody, personalisation_hooks, is_active } = body;

  if (!sector || !sector_label || !touch_number || !touch_label || !templateBody) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: sector, sector_label, touch_number, touch_label, body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const template = await createOutreachTemplate({
    sector: sector as string,
    sector_label: sector_label as string,
    touch_number: touch_number as number,
    touch_label: touch_label as string,
    subject: (subject as string) || null,
    body: templateBody as string,
    personalisation_hooks: (personalisation_hooks as string[]) || [],
    is_active: is_active !== false,
  });

  if (!template) {
    return new Response(
      JSON.stringify({ error: 'Failed to create template. Check for duplicate sector/touch combination.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({ template }),
    { status: 201, headers: { 'Content-Type': 'application/json' } },
  );
}
