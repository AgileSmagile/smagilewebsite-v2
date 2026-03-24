import type { APIContext } from 'astro';
import { updateOutreachTemplate, deleteOutreachTemplate } from '../../../../lib/admin/outreach-templates';

export const prerender = false;

export async function PATCH({ params, request }: APIContext) {
  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing template ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updates: Record<string, unknown> = {};
  const allowedFields = ['sector', 'sector_label', 'touch_number', 'touch_label', 'subject', 'body', 'personalisation_hooks', 'is_active'];

  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return new Response(
      JSON.stringify({ error: 'No valid fields to update' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const template = await updateOutreachTemplate(id, updates);

  if (!template) {
    return new Response(
      JSON.stringify({ error: 'Failed to update template. It may not exist or there may be a duplicate sector/touch combination.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({ template }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

export async function DELETE({ params }: APIContext) {
  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing template ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const success = await deleteOutreachTemplate(id);

  if (!success) {
    return new Response(
      JSON.stringify({ error: 'Failed to delete template' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
