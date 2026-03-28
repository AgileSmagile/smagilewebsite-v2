import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./supabase', () => ({
  getSupabaseAdmin: vi.fn(() => null),
}));

import { getSupabaseAdmin } from './supabase';
import { getPartners, getPartnerCount, scorePartnerMatch } from './partners';
import type { PartnerProfile } from './partners';
import type { JobOpportunity } from './opportunities';

const mockGetSupabaseAdmin = vi.mocked(getSupabaseAdmin);

function mockQueryBuilder(resolvedValue: { data?: unknown; count?: unknown; error: unknown }) {
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

function mockClient(resolvedValue: { data?: unknown; count?: unknown; error: unknown }) {
  const { proxy } = mockQueryBuilder(resolvedValue);
  return { from: vi.fn(() => proxy) };
}

/** Helper to create a minimal PartnerProfile for testing. */
function makePartner(overrides: Partial<PartnerProfile> = {}): PartnerProfile {
  return {
    id: 'p1',
    name: 'Test Partner',
    email: null,
    phone: null,
    linkedin_url: null,
    location: null,
    day_rate_min: null,
    day_rate_max: null,
    ir35_preference: 'outside',
    availability: 'immediate',
    availability_from: null,
    skills: null,
    role_titles: null,
    bio: null,
    notes: null,
    is_active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

/** Helper to create a minimal JobOpportunity for testing. */
function makeOpportunity(overrides: Partial<JobOpportunity> = {}): JobOpportunity {
  return {
    id: 'j1',
    source: 'reed',
    source_id: 'r1',
    title: 'Software Developer',
    description_snippet: null,
    day_rate_min: null,
    day_rate_max: null,
    agency: null,
    end_client: null,
    location: null,
    ir35_status: 'outside',
    date_posted: null,
    url: 'https://example.com',
    status: 'new',
    match_score: null,
    match_reasons: null,
    businessmap_card_id: null,
    first_seen_at: '2026-01-01',
    ...overrides,
  };
}

describe('partners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseAdmin.mockReturnValue(null);
  });

  describe('getPartners', () => {
    it('returns [] when no Supabase client', async () => {
      const result = await getPartners();
      expect(result).toEqual([]);
    });

    it('returns partners from Supabase', async () => {
      const partners = [{ id: 'p1', name: 'Alice', is_active: true }];
      const client = mockClient({ data: partners, error: null });
      mockGetSupabaseAdmin.mockReturnValue(client as never);

      const result = await getPartners();
      expect(result).toEqual(partners);
      expect(client.from).toHaveBeenCalledWith('partner_profiles');
    });
  });

  describe('getPartnerCount', () => {
    it('returns 0 when no Supabase client', async () => {
      const result = await getPartnerCount();
      expect(result).toBe(0);
    });

    it('returns count from Supabase', async () => {
      const client = mockClient({ count: 5, error: null });
      mockGetSupabaseAdmin.mockReturnValue(client as never);

      const result = await getPartnerCount();
      expect(result).toBe(5);
    });
  });

  describe('scorePartnerMatch', () => {
    it('returns 0 when there is no match at all', () => {
      const partner = makePartner({
        role_titles: ['Data Scientist'],
        skills: ['Python', 'ML'],
        day_rate_min: 900,
      });
      const opportunity = makeOpportunity({
        title: 'Receptionist',
        description_snippet: 'Front desk duties',
        day_rate_min: 100,
        day_rate_max: 150,
      });

      const result = scorePartnerMatch(partner, opportunity);
      expect(result.score).toBe(0);
      expect(result.reasons).toHaveLength(0);
    });

    it('gives points for role title matching', () => {
      const partner = makePartner({
        role_titles: ['Software Developer'],
      });
      const opportunity = makeOpportunity({
        title: 'Software Developer',
      });

      const result = scorePartnerMatch(partner, opportunity);
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.reasons.some((r) => r.includes('Role match'))).toBe(true);
    });

    it('gives points for partial role title matching', () => {
      const partner = makePartner({
        role_titles: ['Senior Developer'],
      });
      const opportunity = makeOpportunity({
        title: 'Lead Developer Engineer',
      });

      const result = scorePartnerMatch(partner, opportunity);
      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons.some((r) => r.includes('Role match'))).toBe(true);
    });

    it('gives points for skills matching', () => {
      const partner = makePartner({
        skills: ['TypeScript', 'React', 'Node.js'],
      });
      const opportunity = makeOpportunity({
        title: 'Frontend Engineer',
        description_snippet: 'We need someone with TypeScript and React experience',
      });

      const result = scorePartnerMatch(partner, opportunity);
      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons.some((r) => r.includes('Skills'))).toBe(true);
    });

    it('gives points for rate matching', () => {
      const partner = makePartner({
        day_rate_min: 500,
      });
      const opportunity = makeOpportunity({
        day_rate_min: 400,
        day_rate_max: 600,
      });

      const result = scorePartnerMatch(partner, opportunity);
      expect(result.score).toBe(20);
      expect(result.reasons.some((r) => r.includes('Rate compatible'))).toBe(true);
    });

    it('gives partial rate credit when partner is slightly above range', () => {
      const partner = makePartner({
        day_rate_min: 550,
      });
      const opportunity = makeOpportunity({
        day_rate_min: 500,
        day_rate_max: 500,
      });

      const result = scorePartnerMatch(partner, opportunity);
      expect(result.score).toBe(10);
      expect(result.reasons.some((r) => r.includes('Rate close'))).toBe(true);
    });

    it('scores a full match combining role, skills, and rate', () => {
      const partner = makePartner({
        role_titles: ['Software Developer'],
        skills: ['TypeScript', 'Node.js'],
        day_rate_min: 500,
      });
      const opportunity = makeOpportunity({
        title: 'Software Developer',
        description_snippet: 'TypeScript and Node.js required',
        day_rate_min: 450,
        day_rate_max: 600,
      });

      const result = scorePartnerMatch(partner, opportunity);
      // Should have role (40) + skills (40) + rate (20) = 100
      expect(result.score).toBe(100);
      expect(result.reasons.length).toBeGreaterThanOrEqual(3);
    });
  });
});
