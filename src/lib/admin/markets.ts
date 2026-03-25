/**
 * Market data fetching for the admin price dashboard.
 *
 * Sources:
 *  - Crypto (BTC, ETH): CoinGecko free API v3 (no key)
 *  - Forex (GBP/USD, GBP/EUR, EUR/USD): Frankfurter API (no key)
 *  - Precious metals (Gold, Silver): placeholder with TODO
 *
 * All responses are cached in-memory (30-60s) via the shared cache module
 * to stay within free-tier rate limits.
 */

import { cacheGet, cacheSet } from './cache';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PricePoint {
  timestamp: number; // ms epoch
  price: number;
}

export interface AssetPrice {
  id: string;
  name: string;
  symbol: string;
  category: 'crypto' | 'forex' | 'metal';
  currency: string;
  currentPrice: number | null;
  change24h: number | null; // percentage
  history24h: PricePoint[];
  history7d: PricePoint[];
  history30d: PricePoint[];
}

// ---------------------------------------------------------------------------
// CoinGecko helpers
// ---------------------------------------------------------------------------

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const CRYPTO_IDS = ['bitcoin', 'ethereum'] as const;
const CRYPTO_NAMES: Record<string, string> = { bitcoin: 'Bitcoin', ethereum: 'Ethereum' };
const CRYPTO_SYMBOLS: Record<string, string> = { bitcoin: 'BTC', ethereum: 'ETH' };

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      console.error(`[markets] ${url} returned ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[markets] fetch error for ${url}:`, err);
    return null;
  }
}

interface CoinGeckoPriceResponse {
  [id: string]: {
    gbp: number;
    gbp_24h_change?: number;
  };
}

interface CoinGeckoMarketChart {
  prices: [number, number][];
}

async function fetchCryptoPrices(): Promise<CoinGeckoPriceResponse | null> {
  const cacheKey = 'markets:crypto:prices';
  const cached = cacheGet<CoinGeckoPriceResponse>(cacheKey);
  if (cached) return cached;

  const ids = CRYPTO_IDS.join(',');
  const url = `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=gbp&include_24hr_change=true`;
  const data = await fetchJson<CoinGeckoPriceResponse>(url);
  if (data) cacheSet(cacheKey, data, 60_000);
  return data;
}

async function fetchCryptoHistory(
  coinId: string,
  days: number,
): Promise<PricePoint[]> {
  const cacheKey = `markets:crypto:history:${coinId}:${days}`;
  const cached = cacheGet<PricePoint[]>(cacheKey);
  if (cached) return cached;

  const url = `${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=gbp&days=${days}`;
  const data = await fetchJson<CoinGeckoMarketChart>(url);
  if (!data?.prices) return [];

  const points: PricePoint[] = data.prices.map(([ts, price]) => ({
    timestamp: ts,
    price,
  }));

  // Cache shorter periods less aggressively
  const ttl = days <= 1 ? 60_000 : days <= 7 ? 120_000 : 300_000;
  cacheSet(cacheKey, points, ttl);
  return points;
}

// ---------------------------------------------------------------------------
// Forex helpers (Frankfurter API)
// ---------------------------------------------------------------------------

const FRANKFURTER_BASE = 'https://api.frankfurter.app';

interface FrankfurterLatest {
  base: string;
  date: string;
  rates: Record<string, number>;
}

interface FrankfurterTimeSeries {
  base: string;
  start_date: string;
  end_date: string;
  rates: Record<string, Record<string, number>>;
}

const FOREX_PAIRS = [
  { base: 'GBP', quote: 'USD', name: 'GBP/USD' },
  { base: 'GBP', quote: 'EUR', name: 'GBP/EUR' },
  { base: 'EUR', quote: 'USD', name: 'EUR/USD' },
] as const;

async function fetchForexLatest(
  base: string,
  quote: string,
): Promise<{ rate: number } | null> {
  const cacheKey = `markets:forex:latest:${base}:${quote}`;
  const cached = cacheGet<{ rate: number }>(cacheKey);
  if (cached) return cached;

  const url = `${FRANKFURTER_BASE}/latest?from=${base}&to=${quote}`;
  const data = await fetchJson<FrankfurterLatest>(url);
  if (!data?.rates?.[quote]) return null;

  const result = { rate: data.rates[quote] };
  cacheSet(cacheKey, result, 60_000);
  return result;
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchForexHistory(
  base: string,
  quote: string,
  days: number,
): Promise<PricePoint[]> {
  const cacheKey = `markets:forex:history:${base}:${quote}:${days}`;
  const cached = cacheGet<PricePoint[]>(cacheKey);
  if (cached) return cached;

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  const url = `${FRANKFURTER_BASE}/${dateStr(start)}..${dateStr(end)}?from=${base}&to=${quote}`;
  const data = await fetchJson<FrankfurterTimeSeries>(url);
  if (!data?.rates) return [];

  const points: PricePoint[] = Object.entries(data.rates)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rates]) => ({
      timestamp: new Date(date).getTime(),
      price: rates[quote] ?? 0,
    }));

  const ttl = days <= 1 ? 60_000 : days <= 7 ? 120_000 : 300_000;
  cacheSet(cacheKey, points, ttl);
  return points;
}

// ---------------------------------------------------------------------------
// Precious metals placeholder
// ---------------------------------------------------------------------------

// TODO: Integrate a free metals API (metals.dev, goldapi.io, or similar).
// For now, return static placeholder values so the UI can be built and tested.

function metalPlaceholder(name: string, symbol: string, priceGbp: number): AssetPrice {
  const now = Date.now();
  const day = 86_400_000;

  // Generate a simple sine-wave history for visual placeholder
  const generate = (count: number, span: number): PricePoint[] =>
    Array.from({ length: count }, (_, i) => ({
      timestamp: now - span + (span / count) * i,
      price: priceGbp * (1 + 0.02 * Math.sin((i / count) * Math.PI * 4)),
    }));

  return {
    id: symbol.toLowerCase(),
    name,
    symbol,
    category: 'metal',
    currency: 'GBP',
    currentPrice: priceGbp,
    change24h: null,
    history24h: generate(24, day),
    history7d: generate(7 * 4, 7 * day),
    history30d: generate(30, 30 * day),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getAllMarketData(): Promise<AssetPrice[]> {
  const results: AssetPrice[] = [];

  // --- Crypto ---
  const cryptoPrices = await fetchCryptoPrices();
  for (const coinId of CRYPTO_IDS) {
    const priceData = cryptoPrices?.[coinId];
    const [h24, h7d, h30d] = await Promise.all([
      fetchCryptoHistory(coinId, 1),
      fetchCryptoHistory(coinId, 7),
      fetchCryptoHistory(coinId, 30),
    ]);

    results.push({
      id: coinId,
      name: CRYPTO_NAMES[coinId],
      symbol: CRYPTO_SYMBOLS[coinId],
      category: 'crypto',
      currency: 'GBP',
      currentPrice: priceData?.gbp ?? null,
      change24h: priceData?.gbp_24h_change ?? null,
      history24h: h24,
      history7d: h7d,
      history30d: h30d,
    });
  }

  // --- Forex ---
  for (const pair of FOREX_PAIRS) {
    const latest = await fetchForexLatest(pair.base, pair.quote);
    const [h24, h7d, h30d] = await Promise.all([
      fetchForexHistory(pair.base, pair.quote, 1),
      fetchForexHistory(pair.base, pair.quote, 7),
      fetchForexHistory(pair.base, pair.quote, 30),
    ]);

    // Compute rough 24h change from history
    let change24h: number | null = null;
    if (h24.length >= 2) {
      const first = h24[0].price;
      const last = h24[h24.length - 1].price;
      if (first > 0) change24h = ((last - first) / first) * 100;
    }

    results.push({
      id: `${pair.base.toLowerCase()}-${pair.quote.toLowerCase()}`,
      name: pair.name,
      symbol: pair.name,
      category: 'forex',
      currency: pair.quote,
      currentPrice: latest?.rate ?? null,
      change24h,
      history24h: h24,
      history7d: h7d,
      history30d: h30d,
    });
  }

  // --- Metals (placeholder) ---
  // Approximate GBP spot prices as of March 2026
  results.push(metalPlaceholder('Gold', 'XAU', 1_850));
  results.push(metalPlaceholder('Silver', 'XAG', 23));

  return results;
}
