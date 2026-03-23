import { describe, it, expect } from 'vitest';
import { buildFilterUrl } from './filter-url';

describe('buildFilterUrl', () => {
  it('returns base path with no params when all are defaults', () => {
    const result = buildFilterUrl('/leads', { status: 'all' }, { status: 'all' }, {});
    expect(result).toBe('/leads');
  });

  it('includes params that differ from defaults', () => {
    const result = buildFilterUrl('/leads', {}, { status: 'all' }, { status: 'active' });
    expect(result).toBe('/leads?status=active');
  });

  it('preserves existing non-default params', () => {
    const result = buildFilterUrl(
      '/leads',
      { status: 'active', sort: 'date' },
      { status: 'all', sort: 'name' },
      {},
    );
    expect(result).toContain('status=active');
    expect(result).toContain('sort=date');
  });

  it('overrides existing params', () => {
    const result = buildFilterUrl(
      '/leads',
      { status: 'active' },
      { status: 'all' },
      { status: 'closed' },
    );
    expect(result).toBe('/leads?status=closed');
  });

  it('omits params that match defaults after override', () => {
    const result = buildFilterUrl(
      '/leads',
      { status: 'active' },
      { status: 'all' },
      { status: 'all' },
    );
    expect(result).toBe('/leads');
  });

  it('handles empty inputs', () => {
    expect(buildFilterUrl('/test', {}, {}, {})).toBe('/test');
  });

  it('handles multiple params with mixed defaults', () => {
    const result = buildFilterUrl(
      '/leads',
      { status: 'all', page: '2', sort: 'date' },
      { status: 'all', page: '1', sort: 'name' },
      {},
    );
    expect(result).toContain('page=2');
    expect(result).toContain('sort=date');
    expect(result).not.toContain('status=all');
  });
});
