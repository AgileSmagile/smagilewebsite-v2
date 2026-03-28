import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./supabase', () => ({
  getSupabaseAdmin: vi.fn(() => null),
}));

import { getSupabaseAdmin } from './supabase';
import { getOutreachOpportunities, getOutreachSummary } from './outreach';

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

describe('outreach', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseAdmin.mockReturnValue(null);
  });

  describe('getOutreachOpportunities', () => {
    it('returns [] when no Supabase client', async () => {
      const result = await getOutreachOpportunities();
      expect(result).toEqual([]);
    });

    it('returns mapped opportunities from Supabase', async () => {
      const rawData = [
        {
          id: '1',
          job_opportunity_id: 'j1',
          trigger_type: 'new_role',
          target_name: 'Acme',
          target_type: 'agency',
          suggested_subject: 'Hello',
          suggested_body: 'Body',
          status: 'new',
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
          job_opportunities: {
            title: 'Dev',
            day_rate_min: 500,
            day_rate_max: 700,
            location: 'London',
            url: 'https://example.com',
            agency: 'Agency Co',
            end_client: 'Client Co',
            date_posted: '2026-01-01',
          },
        },
      ];
      const client = mockClient({ data: rawData, error: null });
      mockGetSupabaseAdmin.mockReturnValue(client as never);

      const result = await getOutreachOpportunities();
      expect(result).toHaveLength(1);
      expect(result[0].job_title).toBe('Dev');
      expect(result[0].target_name).toBe('Acme');
    });
  });

  describe('getOutreachSummary', () => {
    it('returns empty summary when no Supabase client', async () => {
      const result = await getOutreachSummary();
      expect(result).toEqual({
        total: 0,
        new: 0,
        sent: 0,
        skipped: 0,
        byTrigger: { new_role: 0, stale_role: 0, closed_role: 0 },
      });
    });

    it('counts statuses and triggers correctly with mock data', async () => {
      const data = [
        { status: 'new', trigger_type: 'new_role' },
        { status: 'new', trigger_type: 'new_role' },
        { status: 'sent', trigger_type: 'stale_role' },
        { status: 'skipped', trigger_type: 'closed_role' },
      ];
      const client = mockClient({ data, error: null });
      mockGetSupabaseAdmin.mockReturnValue(client as never);

      const result = await getOutreachSummary();
      expect(result.total).toBe(4);
      expect(result.new).toBe(2);
      expect(result.sent).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.byTrigger.new_role).toBe(2);
      expect(result.byTrigger.stale_role).toBe(1);
      expect(result.byTrigger.closed_role).toBe(1);
    });
  });
});
