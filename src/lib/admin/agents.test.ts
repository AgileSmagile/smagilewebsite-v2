import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./cache', () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

import { cacheGet, cacheSet } from './cache';
import { getAgentStatuses } from './agents';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('agents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cacheGet).mockReturnValue(undefined);
  });

  it('returns agent list with correct structure', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ version: '1.0.0' }),
    });

    const agents = await getAgentStatuses();

    expect(agents).toBeInstanceOf(Array);
    expect(agents.length).toBeGreaterThan(0);
    for (const agent of agents) {
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('description');
      expect(agent).toHaveProperty('status');
      expect(agent).toHaveProperty('lastChecked');
    }
  });

  it('assigns unknown status to agents without healthUrl', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ version: '1.0.0' }),
    });

    const agents = await getAgentStatuses();
    const noHealthAgent = agents.find((a) => a.healthUrl === null);

    expect(noHealthAgent).toBeDefined();
    expect(noHealthAgent!.status).toBe('unknown');
    expect(noHealthAgent!.responseTimeMs).toBeNull();
    expect(noHealthAgent!.version).toBeNull();
  });

  it('assigns online status when fetch succeeds', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ version: '2.0.0' }),
    });

    const agents = await getAgentStatuses();
    const healthAgent = agents.find((a) => a.healthUrl !== null);

    expect(healthAgent).toBeDefined();
    expect(healthAgent!.status).toBe('online');
    expect(healthAgent!.version).toBe('2.0.0');
    expect(typeof healthAgent!.responseTimeMs).toBe('number');
  });

  it('assigns offline status when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const agents = await getAgentStatuses();
    const healthAgent = agents.find((a) => a.healthUrl !== null);

    expect(healthAgent).toBeDefined();
    expect(healthAgent!.status).toBe('offline');
  });

  it('returns cached data on second call', async () => {
    const cachedData = [
      {
        id: 'cached-agent',
        name: 'Cached',
        description: 'From cache',
        healthUrl: null,
        status: 'unknown' as const,
        lastChecked: '2026-01-01T00:00:00.000Z',
        responseTimeMs: null,
        version: null,
      },
    ];
    vi.mocked(cacheGet).mockReturnValue(cachedData);

    const agents = await getAgentStatuses();

    expect(agents).toBe(cachedData);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(cacheSet).not.toHaveBeenCalled();
  });
});
