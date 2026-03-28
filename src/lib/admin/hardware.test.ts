import { describe, it, expect } from 'vitest';
import { formatUptime, tempColour, diskColour } from './hardware';

describe('formatUptime', () => {
  it('formats with days and hours', () => {
    // 2 days, 5 hours = 2*86400 + 5*3600 = 190800
    expect(formatUptime(190800)).toBe('2d 5h');
  });

  it('formats with hours and minutes when less than a day', () => {
    // 3 hours, 25 minutes = 3*3600 + 25*60 = 12300
    expect(formatUptime(12300)).toBe('3h 25m');
  });

  it('formats minutes only when less than an hour', () => {
    // 45 minutes = 2700
    expect(formatUptime(2700)).toBe('45m');
  });

  it('formats zero minutes', () => {
    expect(formatUptime(0)).toBe('0m');
  });

  it('drops minutes when showing days', () => {
    // 1 day, 0 hours, 30 minutes
    expect(formatUptime(86400 + 1800)).toBe('1d 0h');
  });
});

describe('tempColour', () => {
  it('returns red for high temps (>= 75)', () => {
    expect(tempColour(75)).toBe('text-red-400');
    expect(tempColour(85)).toBe('text-red-400');
  });

  it('returns amber for warm temps (>= 60, < 75)', () => {
    expect(tempColour(60)).toBe('text-amber-400');
    expect(tempColour(74)).toBe('text-amber-400');
  });

  it('returns green for cool temps (< 60)', () => {
    expect(tempColour(45)).toBe('text-green-400');
    expect(tempColour(59)).toBe('text-green-400');
  });
});

describe('diskColour', () => {
  it('returns red for critical usage (>= 90%)', () => {
    expect(diskColour(90)).toBe('text-red-400');
    expect(diskColour(99)).toBe('text-red-400');
  });

  it('returns amber for high usage (>= 75%, < 90%)', () => {
    expect(diskColour(75)).toBe('text-amber-400');
    expect(diskColour(89)).toBe('text-amber-400');
  });

  it('returns green for normal usage (< 75%)', () => {
    expect(diskColour(50)).toBe('text-green-400');
    expect(diskColour(74)).toBe('text-green-400');
  });
});
