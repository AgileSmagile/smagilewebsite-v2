import { cacheGet, cacheSet } from './cache';

export type AgentStatus = 'online' | 'offline' | 'degraded' | 'unknown';

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  healthUrl: string | null;
  status: AgentStatus;
  lastChecked: string | null;
  responseTimeMs: number | null;
  version: string | null;
}

/** Agent registry — add new agents here. */
const registry: Omit<AgentInfo, 'status' | 'lastChecked' | 'responseTimeMs' | 'version'>[] = [
  {
    id: 'clawdius',
    name: 'Clawdius',
    description: 'AI assistant running on Pi5, accessible via Discord',
    healthUrl: import.meta.env.CLAWBOX_HEALTH_URL || 'https://health-clawbox.smagile.co/health',
  },
  {
    id: 'smagile-xyz',
    name: 'smagile.xyz',
    description: 'Autonomous crypto revenue agent (not yet deployed)',
    healthUrl: null,
  },
];

const CACHE_KEY = 'agent-statuses';
const CACHE_TTL = 30_000; // 30 seconds

async function checkHealth(url: string): Promise<{ status: AgentStatus; responseTimeMs: number; version: string | null }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const responseTimeMs = Date.now() - start;

    if (!res.ok) {
      return { status: 'degraded', responseTimeMs, version: null };
    }

    let version: string | null = null;
    try {
      const body = await res.json();
      version = body.version ?? null;
    } catch {
      // Not JSON — that's fine, just an HTTP health check
    }

    return { status: 'online', responseTimeMs, version };
  } catch {
    return { status: 'offline', responseTimeMs: Date.now() - start, version: null };
  }
}

export async function getAgentStatuses(): Promise<AgentInfo[]> {
  const cached = cacheGet<AgentInfo[]>(CACHE_KEY);
  if (cached) return cached;

  const now = new Date().toISOString();
  const results: AgentInfo[] = await Promise.all(
    registry.map(async (agent) => {
      if (!agent.healthUrl) {
        return { ...agent, status: 'unknown' as const, lastChecked: now, responseTimeMs: null, version: null };
      }
      const health = await checkHealth(agent.healthUrl);
      return { ...agent, ...health, lastChecked: now };
    }),
  );

  cacheSet(CACHE_KEY, results, CACHE_TTL);
  return results;
}
