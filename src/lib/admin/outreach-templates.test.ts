import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./supabase', () => ({
  getSupabaseAdmin: vi.fn(() => null),
}));

import { getSupabaseAdmin } from './supabase';
import {
  getOutreachTemplates,
  getOutreachTemplate,
  createOutreachTemplate,
  updateOutreachTemplate,
  deleteOutreachTemplate,
} from './outreach-templates';

const mockGetSupabaseAdmin = vi.mocked(getSupabaseAdmin);

function mockQueryBuilder(resolvedValue: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const chain = () =>
    new Proxy(builder, {
      get(_target, prop) {
        if (typeof prop === 'symbol') return undefined;
        if (!builder[prop]) {
          builder[prop] = vi.fn(() => chain());
        }
        return builder[prop];
      },
    });

  builder.then = vi.fn((resolve) => resolve(resolvedValue));

  return { builder, proxy: chain() };
}

function mockClient(resolvedValue: { data: unknown; error: unknown }) {
  const { proxy } = mockQueryBuilder(resolvedValue);
  return { from: vi.fn(() => proxy) };
}

describe('outreach-templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseAdmin.mockReturnValue(null);
  });

  describe('getOutreachTemplates', () => {
    it('returns [] when no Supabase client', async () => {
      const result = await getOutreachTemplates();
      expect(result).toEqual([]);
    });

    it('returns templates from Supabase', async () => {
      const templates = [
        { id: '1', sector: 'tech', touch_number: 1, body: 'Hello' },
      ];
      const client = mockClient({ data: templates, error: null });
      mockGetSupabaseAdmin.mockReturnValue(client as never);

      const result = await getOutreachTemplates();
      expect(result).toEqual(templates);
    });
  });

  describe('getOutreachTemplate', () => {
    it('returns null when no Supabase client', async () => {
      const result = await getOutreachTemplate('some-id');
      expect(result).toBeNull();
    });

    it('returns a single template by ID', async () => {
      const template = { id: '1', sector: 'tech', body: 'Hello' };
      const client = mockClient({ data: template, error: null });
      mockGetSupabaseAdmin.mockReturnValue(client as never);

      const result = await getOutreachTemplate('1');
      expect(result).toEqual(template);
    });
  });

  describe('createOutreachTemplate', () => {
    it('returns null when no Supabase client', async () => {
      const result = await createOutreachTemplate({
        sector: 'tech',
        sector_label: 'Technology',
        touch_number: 1,
        touch_label: 'First touch',
        subject: 'Hi',
        body: 'Hello',
        personalisation_hooks: [],
        is_active: true,
      });
      expect(result).toBeNull();
    });

    it('creates and returns a new template', async () => {
      const created = { id: '2', sector: 'tech', body: 'Hello' };
      const client = mockClient({ data: created, error: null });
      mockGetSupabaseAdmin.mockReturnValue(client as never);

      const result = await createOutreachTemplate({
        sector: 'tech',
        sector_label: 'Technology',
        touch_number: 1,
        touch_label: 'First touch',
        subject: 'Hi',
        body: 'Hello',
        personalisation_hooks: [],
        is_active: true,
      });
      expect(result).toEqual(created);
    });
  });

  describe('updateOutreachTemplate', () => {
    it('returns null when no Supabase client', async () => {
      const result = await updateOutreachTemplate('some-id', { body: 'Updated' });
      expect(result).toBeNull();
    });

    it('updates and returns the template', async () => {
      const updated = { id: '1', body: 'Updated' };
      const client = mockClient({ data: updated, error: null });
      mockGetSupabaseAdmin.mockReturnValue(client as never);

      const result = await updateOutreachTemplate('1', { body: 'Updated' });
      expect(result).toEqual(updated);
    });
  });

  describe('deleteOutreachTemplate', () => {
    it('returns false when no Supabase client', async () => {
      const result = await deleteOutreachTemplate('some-id');
      expect(result).toBe(false);
    });

    it('returns true on successful deletion', async () => {
      const client = mockClient({ data: null, error: null });
      mockGetSupabaseAdmin.mockReturnValue(client as never);

      const result = await deleteOutreachTemplate('1');
      expect(result).toBe(true);
    });
  });
});
