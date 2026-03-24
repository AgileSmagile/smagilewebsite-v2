import { getSupabaseAdmin } from './supabase';

export interface OutreachTemplate {
  id: string;
  sector: string;
  sector_label: string;
  touch_number: number;
  touch_label: string;
  subject: string | null;
  body: string;
  personalisation_hooks: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all outreach templates, optionally filtered by sector.
 * Returns templates ordered by sector then touch number.
 */
export async function getOutreachTemplates(sectorFilter?: string): Promise<OutreachTemplate[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  let query = sb
    .from('outreach_templates')
    .select('*')
    .order('sector', { ascending: true })
    .order('touch_number', { ascending: true });

  if (sectorFilter && sectorFilter !== 'all') {
    query = query.eq('sector', sectorFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[OutreachTemplates] Fetch error:', error.message);
    return [];
  }

  return (data || []) as OutreachTemplate[];
}

/**
 * Fetch a single outreach template by ID.
 */
export async function getOutreachTemplate(id: string): Promise<OutreachTemplate | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const { data, error } = await sb
    .from('outreach_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[OutreachTemplates] Fetch single error:', error.message);
    return null;
  }

  return data as OutreachTemplate | null;
}

/**
 * Update an existing outreach template.
 */
export async function updateOutreachTemplate(
  id: string,
  updates: Partial<Pick<OutreachTemplate, 'sector' | 'sector_label' | 'touch_number' | 'touch_label' | 'subject' | 'body' | 'personalisation_hooks' | 'is_active'>>,
): Promise<OutreachTemplate | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const { data, error } = await sb
    .from('outreach_templates')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('[OutreachTemplates] Update error:', error.message);
    return null;
  }

  return data as OutreachTemplate | null;
}

/**
 * Create a new outreach template.
 */
export async function createOutreachTemplate(
  template: Omit<OutreachTemplate, 'id' | 'created_at' | 'updated_at'>,
): Promise<OutreachTemplate | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const { data, error } = await sb
    .from('outreach_templates')
    .insert(template)
    .select('*')
    .single();

  if (error) {
    console.error('[OutreachTemplates] Create error:', error.message);
    return null;
  }

  return data as OutreachTemplate | null;
}

/**
 * Delete an outreach template by ID.
 */
export async function deleteOutreachTemplate(id: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;

  const { error } = await sb
    .from('outreach_templates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[OutreachTemplates] Delete error:', error.message);
    return false;
  }

  return true;
}
