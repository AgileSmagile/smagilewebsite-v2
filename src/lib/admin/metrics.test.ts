import { describe, it, expect } from 'vitest';
import {
  getTrend,
  formatNumber,
  formatDuration,
  formatPct,
  formatRelativeDate,
  formatFilePath,
  estimateAiCost,
  extractSparkline,
  type CodeHealthSnapshot,
  type Trend,
} from './metrics';

// ---------------------------------------------------------------------------
// getTrend
// ---------------------------------------------------------------------------

describe('getTrend', () => {
  it('returns "up" when latest is greater than previous', () => {
    expect(getTrend(10, 5)).toBe('up');
  });

  it('returns "down" when latest is less than previous', () => {
    expect(getTrend(3, 7)).toBe('down');
  });

  it('returns "flat" when values are equal', () => {
    expect(getTrend(5, 5)).toBe('flat');
  });

  it('returns "flat" when latest is null', () => {
    expect(getTrend(null, 5)).toBe('flat');
  });

  it('returns "flat" when previous is null', () => {
    expect(getTrend(10, null)).toBe('flat');
  });

  it('returns "flat" when both are null', () => {
    expect(getTrend(null, null)).toBe('flat');
  });
});

// ---------------------------------------------------------------------------
// formatNumber
// ---------------------------------------------------------------------------

describe('formatNumber', () => {
  it('returns "--" for null', () => {
    expect(formatNumber(null)).toBe('--');
  });

  it('returns "--" for undefined', () => {
    expect(formatNumber(undefined)).toBe('--');
  });

  it('formats millions with M suffix', () => {
    expect(formatNumber(2_500_000)).toBe('2.5M');
  });

  it('formats thousands with k suffix', () => {
    expect(formatNumber(1_500)).toBe('1.5k');
  });

  it('formats small numbers using en-GB locale', () => {
    const result = formatNumber(42);
    expect(result).toBe('42');
  });

  it('formats exactly 1,000 with k suffix', () => {
    expect(formatNumber(1_000)).toBe('1.0k');
  });

  it('formats exactly 1,000,000 with M suffix', () => {
    expect(formatNumber(1_000_000)).toBe('1.0M');
  });

  it('formats zero correctly', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------

describe('formatDuration', () => {
  it('returns "--" for null', () => {
    expect(formatDuration(null)).toBe('--');
  });

  it('formats sub-second durations in milliseconds', () => {
    expect(formatDuration(450)).toBe('450ms');
  });

  it('formats durations of 1 second or more in seconds', () => {
    expect(formatDuration(1500)).toBe('1.5s');
  });

  it('formats exactly 1000ms as seconds', () => {
    expect(formatDuration(1000)).toBe('1.0s');
  });

  it('formats zero milliseconds', () => {
    expect(formatDuration(0)).toBe('0ms');
  });
});

// ---------------------------------------------------------------------------
// formatPct
// ---------------------------------------------------------------------------

describe('formatPct', () => {
  it('returns "--" for null', () => {
    expect(formatPct(null)).toBe('--');
  });

  it('formats a percentage with one decimal place', () => {
    expect(formatPct(85.678)).toBe('85.7%');
  });

  it('formats zero', () => {
    expect(formatPct(0)).toBe('0.0%');
  });

  it('formats 100', () => {
    expect(formatPct(100)).toBe('100.0%');
  });
});

// ---------------------------------------------------------------------------
// formatRelativeDate
// ---------------------------------------------------------------------------

describe('formatRelativeDate', () => {
  it('returns "--" for null', () => {
    expect(formatRelativeDate(null)).toBe('--');
  });

  it('returns "just now" for a date less than a minute ago', () => {
    const now = new Date();
    expect(formatRelativeDate(now.toISOString())).toBe('just now');
  });

  it('returns minutes ago for recent dates', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelativeDate(fiveMinAgo)).toBe('5m ago');
  });

  it('returns hours ago for dates within 24 hours', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000).toISOString();
    expect(formatRelativeDate(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days ago for dates within 7 days', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
    expect(formatRelativeDate(twoDaysAgo)).toBe('2d ago');
  });

  it('returns a formatted date for dates older than 7 days', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const result = formatRelativeDate(twoWeeksAgo);
    // Should be in "d Mon" format from en-GB locale, not "--"
    expect(result).not.toBe('--');
    expect(result).not.toContain('ago');
  });
});

// ---------------------------------------------------------------------------
// formatFilePath
// ---------------------------------------------------------------------------

describe('formatFilePath', () => {
  it('strips everything before src/', () => {
    expect(formatFilePath('/home/user/project/src/lib/utils.ts')).toBe(
      'src/lib/utils.ts',
    );
  });

  it('strips common prefixes when no src/ is found', () => {
    expect(formatFilePath('/var/www/app/components/Button.tsx')).toBe(
      'app/components/Button.tsx',
    );
  });

  it('handles paths that start with src/', () => {
    expect(formatFilePath('src/pages/index.astro')).toBe(
      'src/pages/index.astro',
    );
  });
});

// ---------------------------------------------------------------------------
// estimateAiCost
// ---------------------------------------------------------------------------

describe('estimateAiCost', () => {
  it('returns a dollar amount for a meaningful token count', () => {
    // 1M tokens at $8/1M = $8.00
    expect(estimateAiCost(1_000_000)).toBe('$8.00');
  });

  it('returns "<$0.01" for very small token counts', () => {
    expect(estimateAiCost(100)).toBe('<$0.01');
  });

  it('handles zero tokens', () => {
    expect(estimateAiCost(0)).toBe('<$0.01');
  });
});

// ---------------------------------------------------------------------------
// extractSparkline
// ---------------------------------------------------------------------------

describe('extractSparkline', () => {
  const makeSnapshot = (overrides: Partial<CodeHealthSnapshot>): CodeHealthSnapshot => ({
    lines_of_code: null,
    sloc: null,
    test_count: null,
    tests_passing: null,
    tests_failing: null,
    test_coverage_pct: null,
    lint_errors: null,
    lint_warnings: null,
    vuln_critical: null,
    vuln_high: null,
    vuln_moderate: null,
    build_time_ms: null,
    bundle_size_kb: null,
    insertions_30d: null,
    deletions_30d: null,
    files_changed_30d: null,
    type_safety_any_count: null,
    todo_fixme_count: null,
    created_at: new Date().toISOString(),
    ...overrides,
  });

  it('extracts numeric values for a given field', () => {
    const history = [
      makeSnapshot({ sloc: 100 }),
      makeSnapshot({ sloc: 200 }),
      makeSnapshot({ sloc: 300 }),
    ];
    expect(extractSparkline(history, 'sloc')).toEqual([100, 200, 300]);
  });

  it('filters out null values', () => {
    const history = [
      makeSnapshot({ sloc: 100 }),
      makeSnapshot({ sloc: null }),
      makeSnapshot({ sloc: 300 }),
    ];
    expect(extractSparkline(history, 'sloc')).toEqual([100, 300]);
  });

  it('returns an empty array when all values are null', () => {
    const history = [
      makeSnapshot({ sloc: null }),
      makeSnapshot({ sloc: null }),
    ];
    expect(extractSparkline(history, 'sloc')).toEqual([]);
  });

  it('returns an empty array for empty history', () => {
    expect(extractSparkline([], 'sloc')).toEqual([]);
  });
});
