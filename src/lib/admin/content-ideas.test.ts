import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the supabase module
vi.mock('./supabase', () => ({
  getSupabaseAdmin: vi.fn(() => null),
}));

import { getSupabaseAdmin } from './supabase';
import {
  getContentIdeas,
  getContentIdea,
  createContentIdea,
  updateContentIdea,
  deleteContentIdea,
} from './content-ideas';

const mockGetSupabaseAdmin = vi.mocked(getSupabaseAdmin);

/** Build a chainable mock Supabase query builder. */
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

  // The terminal call (the one that's awaited) must resolve
  builder.then = vi.fn((resolve) => resolve(resolvedValue));

  return { builder, proxy: chain() };
}

function mockClient(resolvedValue: { data: unknown; error: unknown }) {
  const { proxy } = mockQueryBuilder(resolvedValue);
  return { from: vi.fn(() => proxy) };
}

describe('content-ideas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseAdmin.mockReturnValue(null);
  });

  describe('getContentIdeas', () => {
    it('returns [] when no Supabase client', async () => {
      const result = await getContentIdeas();
      expect(result).toEqual([]);
    });

    it('returns ideas from Supabase', async () => {
      const ideas = [
        { id: '1', category: 'social_media', title: 'Test Idea', status: 'idea' },
      ];
      const client = mockClient({ data: ideas, error: null });
      mockGetSupabaseAdmin.mockReturnValue(client as never);

      const result = await getContentIdeas();
      expect(result).toEqual(ideas);
      expect(client.from).toHaveBeenCalledWith('content_ideas');
    });

    it('applies category filter', async () => {
      const client = mockClient({ data: [], error: null });
      mockGetSupabaseAdmin.mockReturnValue(client as never);

      await getContentIdeas({ category: 'social_media' });
      expect(client.from).toHaveBeenCalledWith('content_ideas');
    });

    it('returns [] on error', async () => {
      const client = mockClient({ data: null, error: { message: 'fail' } });
      mockGetSupabaseAdmin.mockReturnValue(client as never);

      const result = await getContentIdeas();
      expect(result).toEqual([]);
    });
  });

  describe('getContentIdea', () => {
    it('returns null when no Supabase client', async () => {
      const result = await getContentIdea('some-id');
      expect(result).toBeNull();
    });

    it('returns an idea by ID', async () => {
      const idea = { id: '1', category: 'social_media', title: 'Test' };
      const client = mockClient({ data: idea, error: null });
      mockGetSupabaseAdmin.mockReturnValue(client as never);

      const result = await getContentIdea('1');
      expect(result).toEqual(idea);
    });
  });

  describe('createContentIdea', () => {
    it('returns null when no Supabase client', async () => {
      const result = await createContentIdea({
        category: 'social_media',
        raw_input: 'test input',
      });
      expect(result).toBeNull();
    });

    it('creates and returns a new idea', async () => {
      const created = { id: '2', category: 'social_media', raw_input: 'test' };
      const client = mockClient({ data: created, error: null });
      mockGetSupabaseAdmin.mockReturnValue(client as never);

      const result = await createContentIdea({
        category: 'social_media',
        raw_input: 'test',
      });
      expect(result).toEqual(created);
    });
  });

  describe('updateContentIdea', () => {
    it('returns null when no Supabase client', async () => {
      const result = await updateContentIdea('some-id', { title: 'Updated' });
      expect(result).toBeNull();
    });

    it('updates and returns the idea', async () => {
      const updated = { id: '1', title: 'Updated' };
      const client = mockClient({ data: updated, error: null });
      mockGetSupabaseAdmin.mockReturnValue(client as never);

      const result = await updateContentIdea('1', { title: 'Updated' });
      expect(result).toEqual(updated);
    });
  });

  describe('deleteContentIdea', () => {
    it('returns false when no Supabase client', async () => {
      const result = await deleteContentIdea('some-id');
      expect(result).toBe(false);
    });

    it('returns true on successful deletion', async () => {
      const client = mockClient({ data: null, error: null });
      mockGetSupabaseAdmin.mockReturnValue(client as never);

      const result = await deleteContentIdea('1');
      expect(result).toBe(true);
    });
  });
});
