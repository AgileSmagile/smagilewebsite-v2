import type { APIContext } from 'astro';
import { updateContentIdea, deleteContentIdea } from '../../../../lib/admin/content-ideas';
import { jsonOk, jsonError } from '../../../../lib/admin/api-response';

export const prerender = false;

export async function PATCH({ params, request }: APIContext) {
  const { id } = params;

  if (!id) {
    return jsonError('Missing idea ID');
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const updates: Record<string, unknown> = {};
  const allowedFields = ['category', 'raw_input', 'title', 'content', 'status'];

  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return jsonError('No valid fields to update');
  }

  if (updates.category) {
    const validCategories = ['social_media', 'learning_catalogue'];
    if (!validCategories.includes(updates.category as string)) {
      return jsonError('Invalid category. Must be social_media or learning_catalogue');
    }
  }

  if (updates.status) {
    const validStatuses = ['idea', 'drafted', 'published', 'archived'];
    if (!validStatuses.includes(updates.status as string)) {
      return jsonError('Invalid status. Must be idea, drafted, published, or archived');
    }
  }

  const idea = await updateContentIdea(id, updates);

  if (!idea) {
    return jsonError('Failed to update content idea. It may not exist.', 500);
  }

  return jsonOk({ idea });
}

export async function DELETE({ params }: APIContext) {
  const { id } = params;

  if (!id) {
    return jsonError('Missing idea ID');
  }

  const success = await deleteContentIdea(id);

  if (!success) {
    return jsonError('Failed to delete content idea', 500);
  }

  return jsonOk({ success: true });
}
