import { describe, it, expect } from 'vitest';
import { formatRate, scoreColour, scoreBg } from './format';

describe('formatRate', () => {
  it('returns "Not stated" when both null', () => {
    expect(formatRate(null, null)).toBe('Not stated');
  });

  it('formats range when min and max differ', () => {
    expect(formatRate(500, 700)).toBe('\u00a3500-\u00a3700/day');
  });

  it('formats single value when min equals max', () => {
    expect(formatRate(600, 600)).toBe('\u00a3600/day');
  });

  it('uses max when only max provided', () => {
    expect(formatRate(null, 700)).toBe('\u00a3700/day');
  });

  it('uses min when only min provided', () => {
    expect(formatRate(500, null)).toBe('\u00a3500/day');
  });

  it('handles zero as falsy (returns "Not stated")', () => {
    expect(formatRate(0, 0)).toBe('Not stated');
  });
});

describe('scoreColour', () => {
  it('returns grey for null', () => {
    expect(scoreColour(null)).toBe('text-grey-500');
  });

  it('returns grey for 0', () => {
    expect(scoreColour(0)).toBe('text-grey-500');
  });

  it('returns grey for low scores (< 30)', () => {
    expect(scoreColour(15)).toBe('text-grey-500');
    expect(scoreColour(29)).toBe('text-grey-500');
  });

  it('returns amber for mid scores (30-59)', () => {
    expect(scoreColour(30)).toBe('text-amber-400');
    expect(scoreColour(45)).toBe('text-amber-400');
    expect(scoreColour(59)).toBe('text-amber-400');
  });

  it('returns green for high scores (>= 60)', () => {
    expect(scoreColour(60)).toBe('text-green-400');
    expect(scoreColour(85)).toBe('text-green-400');
    expect(scoreColour(100)).toBe('text-green-400');
  });
});

describe('scoreBg', () => {
  it('returns grey for null', () => {
    expect(scoreBg(null)).toBe('bg-grey-700/30');
  });

  it('returns grey for 0', () => {
    expect(scoreBg(0)).toBe('bg-grey-700/30');
  });

  it('returns amber bg for mid scores', () => {
    expect(scoreBg(45)).toBe('bg-amber-500/20');
  });

  it('returns green bg for high scores', () => {
    expect(scoreBg(75)).toBe('bg-green-500/20');
  });
});
