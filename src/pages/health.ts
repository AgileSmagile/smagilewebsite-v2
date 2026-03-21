import type { APIContext } from 'astro';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const prerender = false;

function getVersion(): string {
  try {
    const pkgPath = join(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function GET(_context: APIContext) {
  const body = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime() * 10) / 10,
    version: getVersion(),
    node: process.version,
    memory: Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10,
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
