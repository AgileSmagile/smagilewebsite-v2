import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./supabase', () => ({
  getSupabaseAdmin: vi.fn(() => null),
}));

vi.mock('./cache', () => ({
  cacheGet: vi.fn(() => undefined),
  cacheSet: vi.fn(),
}));

import { getSupabaseAdmin } from './supabase';
import {
  getOpportunities,
  getOpportunitySummary,
  getEmergencyOpportunities,
  getPartnerOpportunities,
} from './opportunities';

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

describe('opportunities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseAdmin.mockReturnValue(null);
  });

  describe('getOpportunities', () => {
    it('returns [] when no Supabase client', async () => {
      const result = await getOpportunities();
      expect(result).toEqual([]);
    });

    it('returns opportunities from Supabase', async () => {
      const opps = [{ id: '1', title: 'Dev Role', status: 'new' }];
      const client = mockClient({ data: opps, error: null });
      mockGetSupabaseAdmin.mockReturnValue(client as never);

      const result = await getOpportunities();
      expect(result).toEqual(opps);
      expect(client.from).toHaveBeenCalledWith('job_opportunities');
    });
  });

  describe('getOpportunitySummary', () => {
    it('returns zeroed summary when no Supabase client', async () => {
      const result = await getOpportunitySummary();
      expect(result).toEqual({
        total: 0,
        new: 0,
        seen: 0,
        applied: 0,
        highMatch: 0,
      });
    });

    it('counts statuses correctly', async () => {
      const data = [
        { status: 'new', match_score: 80 },
        { status: 'new', match_score: 40 },
        { status: 'seen', match_score: 70 },
        { status: 'applied', match_score: 90 },
      ];
      const client = mockClient({ data, error: null });
      mockGetSupabaseAdmin.mockReturnValue(client as never);

      const result = await getOpportunitySummary();
      expect(result.total).toBe(4);
      expect(result.new).toBe(2);
      expect(result.seen).toBe(1);
      expect(result.applied).toBe(1);
      expect(result.highMatch).toBe(3); // 80, 70, 90 >= 60
    });
  });

  describe('getEmergencyOpportunities', () => {
    it('returns [] when no Supabase client', async () => {
      const result = await getEmergencyOpportunities();
      expect(result).toEqual([]);
    });

    it('returns emergency opportunities from Supabase', async () => {
      const opps = [{ id: '1', title: 'Inside IR35 Role', ir35_status: 'inside' }];
      const client = mockClient({ data: opps, error: null });
      mockGetSupabaseAdmin.mockReturnValue(client as never);

      const result = await getEmergencyOpportunities();
      expect(result).toEqual(opps);
    });
  });

  describe('getPartnerOpportunities', () => {
    it('returns [] when no Supabase client', async () => {
      const result = await getPartnerOpportunities();
      expect(result).toEqual([]);
    });

    it('returns partner opportunities from Supabase', async () => {
      const opps = [{ id: '1', title: 'Outside IR35 Role', ir35_status: 'outside' }];
      const client = mockClient({ data: opps, error: null });
      mockGetSupabaseAdmin.mockReturnValue(client as never);

      const result = await getPartnerOpportunities();
      expect(result).toEqual(opps);
    });
  });
});
