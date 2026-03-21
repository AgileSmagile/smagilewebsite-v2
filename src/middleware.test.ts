import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The middleware uses `defineMiddleware` from 'astro:middleware', which is
 * unavailable outside the Astro build. We mock the module so that
 * `defineMiddleware` simply returns the handler function it receives,
 * letting us call `onRequest` directly.
 */
vi.mock('astro:middleware', () => ({
  defineMiddleware: (fn: unknown) => fn,
}));

// Import after the mock is registered
const { onRequest } = await import('./middleware');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(pathname: string, headers: Record<string, string> = {}) {
  const url = new URL(pathname, 'https://smagile.co');
  const request = new Request(url, { headers });
  return { url, request };
}

type MiddlewareContext = ReturnType<typeof makeContext>;

function makeNext(): () => Promise<Response> {
  return () => Promise.resolve(new Response('OK', { status: 200 }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Middleware', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ---- Security headers ---------------------------------------------------

  describe('security headers', () => {
    it('sets X-Frame-Options to DENY', async () => {
      const response = await (onRequest as (ctx: MiddlewareContext, next: () => Promise<Response>) => Promise<Response>)(
        makeContext('/'),
        makeNext(),
      );
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('sets X-Content-Type-Options to nosniff', async () => {
      const response = await (onRequest as (ctx: MiddlewareContext, next: () => Promise<Response>) => Promise<Response>)(
        makeContext('/about'),
        makeNext(),
      );
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('sets Referrer-Policy', async () => {
      const response = await (onRequest as (ctx: MiddlewareContext, next: () => Promise<Response>) => Promise<Response>)(
        makeContext('/'),
        makeNext(),
      );
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('sets Permissions-Policy to deny camera, microphone, and geolocation', async () => {
      const response = await (onRequest as (ctx: MiddlewareContext, next: () => Promise<Response>) => Promise<Response>)(
        makeContext('/'),
        makeNext(),
      );
      expect(response.headers.get('Permissions-Policy')).toBe(
        'camera=(), microphone=(), geolocation=()',
      );
    });

    it('sets X-XSS-Protection', async () => {
      const response = await (onRequest as (ctx: MiddlewareContext, next: () => Promise<Response>) => Promise<Response>)(
        makeContext('/'),
        makeNext(),
      );
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });

    it('sets Content-Security-Policy', async () => {
      const response = await (onRequest as (ctx: MiddlewareContext, next: () => Promise<Response>) => Promise<Response>)(
        makeContext('/'),
        makeNext(),
      );
      const csp = response.headers.get('Content-Security-Policy');
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
    });
  });

  // ---- Admin auth ---------------------------------------------------------

  describe('admin route authentication', () => {
    it('returns 403 for /admin without Cf-Access-Authenticated-User-Email', async () => {
      const response = await (onRequest as (ctx: MiddlewareContext, next: () => Promise<Response>) => Promise<Response>)(
        makeContext('/admin'),
        makeNext(),
      );
      expect(response.status).toBe(403);
    });

    it('returns 403 for nested admin routes without the header', async () => {
      const response = await (onRequest as (ctx: MiddlewareContext, next: () => Promise<Response>) => Promise<Response>)(
        makeContext('/admin/metrics'),
        makeNext(),
      );
      expect(response.status).toBe(403);
    });

    it('allows admin access when Cf-Access-Authenticated-User-Email is present', async () => {
      const response = await (onRequest as (ctx: MiddlewareContext, next: () => Promise<Response>) => Promise<Response>)(
        makeContext('/admin', {
          'Cf-Access-Authenticated-User-Email': 'james@smagile.co',
        }),
        makeNext(),
      );
      expect(response.status).toBe(200);
    });

    it('allows admin access from localhost without the header', async () => {
      const url = new URL('/admin', 'http://localhost:4321');
      const request = new Request(url);
      const response = await (onRequest as (ctx: MiddlewareContext, next: () => Promise<Response>) => Promise<Response>)(
        { url, request },
        makeNext(),
      );
      expect(response.status).toBe(200);
    });

    it('allows admin access from 127.0.0.1 without the header', async () => {
      const url = new URL('/admin', 'http://127.0.0.1:4321');
      const request = new Request(url);
      const response = await (onRequest as (ctx: MiddlewareContext, next: () => Promise<Response>) => Promise<Response>)(
        { url, request },
        makeNext(),
      );
      expect(response.status).toBe(200);
    });
  });

  // ---- Non-admin routes ---------------------------------------------------

  describe('non-admin routes', () => {
    it('passes through without auth check', async () => {
      const response = await (onRequest as (ctx: MiddlewareContext, next: () => Promise<Response>) => Promise<Response>)(
        makeContext('/'),
        makeNext(),
      );
      expect(response.status).toBe(200);
    });

    it('passes through for /about without auth check', async () => {
      const response = await (onRequest as (ctx: MiddlewareContext, next: () => Promise<Response>) => Promise<Response>)(
        makeContext('/about'),
        makeNext(),
      );
      expect(response.status).toBe(200);
    });

    it('still applies security headers to non-admin routes', async () => {
      const response = await (onRequest as (ctx: MiddlewareContext, next: () => Promise<Response>) => Promise<Response>)(
        makeContext('/blog'),
        makeNext(),
      );
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });
  });
});
