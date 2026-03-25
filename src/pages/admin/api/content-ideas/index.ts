import type { APIContext } from 'astro';
import { createContentIdea } from '../../../../lib/admin/content-ideas';
import { jsonOk, jsonError } from '../../../../lib/admin/api-response';

export const prerender = false;

export async function POST({ request }: APIContext) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const { category, raw_input, title, content, status } = body;

  if (!category || !raw_input) {
    return jsonError('Missing required fields: category, raw_input');
  }

  const validCategories = ['social_media', 'learning_catalogue'];
  if (!validCategories.includes(category as string)) {
    return jsonError('Invalid category. Must be social_media or learning_catalogue');
  }

  const idea = await createContentIdea({
    category: category as 'social_media' | 'learning_catalogue',
    raw_input: raw_input as string,
    title: (title as string) || undefined,
    content: (content as string) || undefined,
    status: (status as 'idea' | 'drafted' | 'published' | 'archived') || undefined,
  });

  if (!idea) {
    return jsonError('Failed to create content idea', 500);
  }

  return jsonOk({ idea }, 201);
}
