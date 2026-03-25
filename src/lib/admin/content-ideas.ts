import { getSupabaseAdmin } from './supabase';

export type ContentCategory = 'social_media' | 'learning_catalogue';
export type ContentStatus = 'idea' | 'drafted' | 'published' | 'archived';

export interface ContentIdea {
  id: string;
  category: ContentCategory;
  raw_input: string;
  title: string | null;
  content: string | null;
  status: ContentStatus;
  created_at: string;
  updated_at: string;
}

export interface ContentIdeaFilters {
  category?: ContentCategory | 'all';
  status?: ContentStatus | 'all';
}

/**
 * Fetch all content ideas, optionally filtered by category and status.
 * Returns ideas ordered by creation date, newest first.
 */
export async function getContentIdeas(filters?: ContentIdeaFilters): Promise<ContentIdea[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  let query = sb
    .from('content_ideas')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.category && filters.category !== 'all') {
    query = query.eq('category', filters.category);
  }

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[ContentIdeas] Fetch error:', error.message);
    return [];
  }

  return (data || []) as ContentIdea[];
}

/**
 * Fetch a single content idea by ID.
 */
export async function getContentIdea(id: string): Promise<ContentIdea | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const { data, error } = await sb
    .from('content_ideas')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[ContentIdeas] Fetch single error:', error.message);
    return null;
  }

  return data as ContentIdea | null;
}

/**
 * Create a new content idea.
 */
export async function createContentIdea(
  idea: Pick<ContentIdea, 'category' | 'raw_input'> & Partial<Pick<ContentIdea, 'title' | 'content' | 'status'>>,
): Promise<ContentIdea | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const { data, error } = await sb
    .from('content_ideas')
    .insert({
      category: idea.category,
      raw_input: idea.raw_input,
      title: idea.title || null,
      content: idea.content || null,
      status: idea.status || 'idea',
    })
    .select('*')
    .single();

  if (error) {
    console.error('[ContentIdeas] Create error:', error.message);
    return null;
  }

  return data as ContentIdea | null;
}

/**
 * Update an existing content idea.
 */
export async function updateContentIdea(
  id: string,
  updates: Partial<Pick<ContentIdea, 'category' | 'raw_input' | 'title' | 'content' | 'status'>>,
): Promise<ContentIdea | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const { data, error } = await sb
    .from('content_ideas')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('[ContentIdeas] Update error:', error.message);
    return null;
  }

  return data as ContentIdea | null;
}

/**
 * Delete a content idea by ID.
 */
export async function deleteContentIdea(id: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;

  const { error } = await sb
    .from('content_ideas')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[ContentIdeas] Delete error:', error.message);
    return false;
  }

  return true;
}
