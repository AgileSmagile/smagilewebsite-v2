import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cacheGet, cacheSet } from './cache';

describe('cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined for missing keys', () => {
    expect(cacheGet('nonexistent')).toBeUndefined();
  });

  it('stores and retrieves a value', () => {
    cacheSet('key1', { data: 'hello' }, 60_000);
    expect(cacheGet('key1')).toEqual({ data: 'hello' });
  });

  it('returns undefined after TTL expires', () => {
    cacheSet('expiring', 'value', 5_000);
    expect(cacheGet('expiring')).toBe('value');

    vi.advanceTimersByTime(5_001);
    expect(cacheGet('expiring')).toBeUndefined();
  });

  it('returns value just before TTL expires', () => {
    cacheSet('almost', 'still-here', 10_000);
    vi.advanceTimersByTime(9_999);
    expect(cacheGet('almost')).toBe('still-here');
  });

  it('overwrites existing key with new value and TTL', () => {
    cacheSet('rewrite', 'first', 5_000);
    cacheSet('rewrite', 'second', 60_000);
    expect(cacheGet('rewrite')).toBe('second');

    vi.advanceTimersByTime(10_000);
    expect(cacheGet('rewrite')).toBe('second'); // new TTL still valid
  });

  it('handles different value types', () => {
    cacheSet('number', 42, 60_000);
    cacheSet('array', [1, 2, 3], 60_000);
    cacheSet('null', null, 60_000);

    expect(cacheGet('number')).toBe(42);
    expect(cacheGet('array')).toEqual([1, 2, 3]);
    expect(cacheGet('null')).toBeNull();
  });
});
