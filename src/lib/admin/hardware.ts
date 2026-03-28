import { execSync } from 'child_process';
import { cacheGet, cacheSet } from './cache';

export interface PiHealth {
  hostname: string;
  platform: string;
  os: string;
  temp: number | null;
  load: string | null;
  mem_total: number | null;
  mem_used: number | null;
  mem_avail: number | null;
  disk_root_pct: number | null;
  disk_usb_pct: number | null;
  disk_usb_avail: string | null;
  usb: string | null;
  uptime: number | null;
  services: Record<string, string>;
  openclaw?: {
    version: string;
    agents: string[];
  };
  ollama?: {
    models: string[];
  };
  collected_at: string;
  error?: string;
}

const CACHE_TTL = 30_000; // 30 seconds

/** Fetch health data from the Clawbox Pi5 via its Cloudflare tunnel. */
export async function getClawboxHealth(): Promise<PiHealth> {
  const cacheKey = 'clawbox-health';
  const cached = cacheGet<PiHealth>(cacheKey);
  if (cached) return cached;

  const url = import.meta.env.CLAWBOX_HEALTH_URL || 'https://health-clawbox.smagile.co/health';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return errorHealth('clawbox', `HTTP ${res.status}`);
    }

    const data = await res.json();
    const health: PiHealth = {
      hostname: data.hostname ?? 'clawbox',
      platform: data.platform ?? 'Raspberry Pi 5',
      os: data.os ?? 'unknown',
      temp: data.pulse?.temp ?? null,
      load: data.pulse?.load ?? null,
      mem_total: data.pulse?.mem_total ?? null,
      mem_used: data.pulse?.mem_used ?? null,
      mem_avail: data.pulse?.mem_avail ?? null,
      disk_root_pct: data.pulse?.disk_root_pct ?? null,
      disk_usb_pct: data.pulse?.disk_usb_pct ?? null,
      disk_usb_avail: data.pulse?.disk_usb_avail ?? null,
      usb: data.pulse?.usb ?? null,
      uptime: data.pulse?.uptime ?? null,
      services: data.services ?? {},
      openclaw: data.openclaw,
      ollama: data.ollama,
      collected_at: data.collected_at ?? new Date().toISOString(),
    };

    cacheSet(cacheKey, health, CACHE_TTL);
    return health;
  } catch (err) {
    return errorHealth('clawbox', err instanceof Error ? err.message : 'Unreachable');
  }
}

/** Collect health data locally from the webserver Pi. */
export async function getWebserverHealth(): Promise<PiHealth> {
  const cacheKey = 'webserver-health';
  const cached = cacheGet<PiHealth>(cacheKey);
  if (cached) return cached;

  try {
    const temp = safeExec("vcgencmd measure_temp 2>/dev/null | sed \"s/temp=//;s/'C//\"");
    const load = safeExec("cat /proc/loadavg 2>/dev/null | awk '{print $1, $2, $3}'");
    const memTotal = safeExec("free -m | awk '/Mem:/{print $2}'");
    const memUsed = safeExec("free -m | awk '/Mem:/{print $3}'");
    const memAvail = safeExec("free -m | awk '/Mem:/{print $7}'");
    const diskRootPct = safeExec("df / | awk 'NR==2{print $5}' | tr -d '%'");
    const uptime = safeExec("awk '{print int($1)}' /proc/uptime");
    const hostname = safeExec('hostname') || 'webserver';

    const services: Record<string, string> = {};
    for (const svc of ['cloudflared', 'nginx', 'smagile-web', 'ssh']) {
      services[svc] = safeExec(`systemctl is-active ${svc} 2>/dev/null`) || 'unknown';
    }

    const health: PiHealth = {
      hostname,
      platform: 'Raspberry Pi 3B+',
      os: safeExec("grep PRETTY_NAME /etc/os-release | sed 's/PRETTY_NAME=\"//;s/\"//'") || 'unknown',
      temp: temp ? parseFloat(temp) : null,
      load: load || null,
      mem_total: memTotal ? parseInt(memTotal) : null,
      mem_used: memUsed ? parseInt(memUsed) : null,
      mem_avail: memAvail ? parseInt(memAvail) : null,
      disk_root_pct: diskRootPct ? parseInt(diskRootPct) : null,
      disk_usb_pct: null,
      disk_usb_avail: null,
      usb: null,
      uptime: uptime ? parseInt(uptime) : null,
      services,
      collected_at: new Date().toISOString(),
    };

    cacheSet(cacheKey, health, CACHE_TTL);
    return health;
  } catch (err) {
    return errorHealth('webserver', err instanceof Error ? err.message : 'Collection failed');
  }
}

function safeExec(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 3000 }).trim();
  } catch {
    return '';
  }
}

function errorHealth(hostname: string, message: string): PiHealth {
  return {
    hostname,
    platform: hostname === 'clawbox' ? 'Raspberry Pi 5' : 'Raspberry Pi 3B+',
    os: 'unknown',
    temp: null,
    load: null,
    mem_total: null,
    mem_used: null,
    mem_avail: null,
    disk_root_pct: null,
    disk_usb_pct: null,
    disk_usb_avail: null,
    usb: null,
    uptime: null,
    services: {},
    collected_at: new Date().toISOString(),
    error: message,
  };
}

/** Format uptime seconds into a human-readable string. */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/** Get a colour class for temperature. */
export function tempColour(temp: number): string {
  if (temp >= 75) return 'text-red-400';
  if (temp >= 60) return 'text-amber-400';
  return 'text-green-400';
}

/** Get a colour class for disk usage percentage. */
export function diskColour(pct: number): string {
  if (pct >= 90) return 'text-red-400';
  if (pct >= 75) return 'text-amber-400';
  return 'text-green-400';
}
