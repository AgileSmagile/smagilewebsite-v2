import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./cache', () => ({
  cacheGet: vi.fn(() => undefined),
  cacheSet: vi.fn(),
}));

import { getAllMarketData } from './markets';

describe('markets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  /** Set up fetch to return mock data for all expected API calls. */
  function setupFetchMock() {
    const mockFetch = vi.mocked(globalThis.fetch);

    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      // CoinGecko simple/price
      if (url.includes('simple/price')) {
        return new Response(
          JSON.stringify({
            bitcoin: { gbp: 40_000, gbp_24h_change: 2.5 },
            ethereum: { gbp: 2_500, gbp_24h_change: -1.2 },
          }),
          { status: 200 },
        );
      }

      // CoinGecko market_chart
      if (url.includes('market_chart')) {
        const now = Date.now();
        return new Response(
          JSON.stringify({
            prices: [
              [now - 86_400_000, 39_000],
              [now, 40_000],
            ],
          }),
          { status: 200 },
        );
      }

      // Frankfurter latest
      if (url.includes('frankfurter') && url.includes('latest')) {
        const params = new URL(url).searchParams;
        const quote = params.get('to') || 'USD';
        return new Response(
          JSON.stringify({
            base: params.get('from') || 'GBP',
            date: '2026-03-28',
            rates: { [quote]: 1.25 },
          }),
          { status: 200 },
        );
      }

      // Frankfurter time series
      if (url.includes('frankfurter') && url.includes('..')) {
        const params = new URL(url).searchParams;
        const quote = params.get('to') || 'USD';
        return new Response(
          JSON.stringify({
            base: params.get('from') || 'GBP',
            start_date: '2026-03-01',
            end_date: '2026-03-28',
            rates: {
              '2026-03-27': { [quote]: 1.24 },
              '2026-03-28': { [quote]: 1.25 },
            },
          }),
          { status: 200 },
        );
      }

      return new Response('Not found', { status: 404 });
    });
  }

  it('returns an array of AssetPrice objects', async () => {
    setupFetchMock();

    const data = await getAllMarketData();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    // Each item should have the required AssetPrice shape
    for (const item of data) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('symbol');
      expect(item).toHaveProperty('category');
      expect(item).toHaveProperty('currency');
      expect(item).toHaveProperty('currentPrice');
    }
  });

  it('includes crypto, forex, and metal categories', async () => {
    setupFetchMock();

    const data = await getAllMarketData();
    const categories = new Set(data.map((d) => d.category));
    expect(categories.has('crypto')).toBe(true);
    expect(categories.has('forex')).toBe(true);
    expect(categories.has('metal')).toBe(true);
  });

  it('always includes metal placeholder data for Gold and Silver', async () => {
    setupFetchMock();

    const data = await getAllMarketData();
    const metals = data.filter((d) => d.category === 'metal');
    expect(metals).toHaveLength(2);

    const gold = metals.find((m) => m.symbol === 'XAU');
    const silver = metals.find((m) => m.symbol === 'XAG');
    expect(gold).toBeDefined();
    expect(silver).toBeDefined();
    expect(gold!.currentPrice).toBe(1_850);
    expect(silver!.currentPrice).toBe(23);
    expect(gold!.history24h.length).toBeGreaterThan(0);
    expect(gold!.history7d.length).toBeGreaterThan(0);
    expect(gold!.history30d.length).toBeGreaterThan(0);
  });

  it('handles fetch failures gracefully', async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockRejectedValue(new Error('Network error'));

    const data = await getAllMarketData();
    // Should still return results (metals are always present)
    expect(Array.isArray(data)).toBe(true);
    const metals = data.filter((d) => d.category === 'metal');
    expect(metals).toHaveLength(2);
  });
});
