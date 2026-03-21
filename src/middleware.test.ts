import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

function makeContext(
  pathname: string,
  headers: Record<string, string> = {},
  options: { base?: string; method?: string } = {},
) {
  const url = new URL(pathname, options.base || 'https://smagile.co');
  const request = new Request(url, { headers, method: options.method || 'GET' });
  return { url, request };
}

type MiddlewareContext = ReturnType<typeof makeContext>;
type MiddlewareFn = (ctx: MiddlewareContext, next: () => Promise<Response>) => Promise<Response>;

function makeNext(): () => Promise<Response> {
  return () => Promise.resolve(new Response('OK', { status: 200 }));
}

function makeSpyNext(): { next: () => Promise<Response>; called: () => boolean } {
  let wasCalled = false;
  return {
    next: () => {
      wasCalled = true;
      return Promise.resolve(new Response('OK', { status: 200 }));
    },
    called: () => wasCalled,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Middleware', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ---- Security headers ---------------------------------------------------

  describe('security headers', () => {
    it('sets X-Frame-Options to DENY', async () => {
      const response = await (onRequest as MiddlewareFn)(makeContext('/'), makeNext());
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('sets X-Content-Type-Options to nosniff', async () => {
      const response = await (onRequest as MiddlewareFn)(makeContext('/about'), makeNext());
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('sets Referrer-Policy', async () => {
      const response = await (onRequest as MiddlewareFn)(makeContext('/'), makeNext());
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('sets Permissions-Policy to deny camera, microphone, and geolocation', async () => {
      const response = await (onRequest as MiddlewareFn)(makeContext('/'), makeNext());
      expect(response.headers.get('Permissions-Policy')).toBe(
        'camera=(), microphone=(), geolocation=()',
      );
    });

    it('sets X-XSS-Protection', async () => {
      const response = await (onRequest as MiddlewareFn)(makeContext('/'), makeNext());
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });

    it('sets Content-Security-Policy with core directives', async () => {
      const response = await (onRequest as MiddlewareFn)(makeContext('/'), makeNext());
      const csp = response.headers.get('Content-Security-Policy');
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
    });

    it('includes form-action, base-uri, and frame-ancestors in CSP', async () => {
      const response = await (onRequest as MiddlewareFn)(makeContext('/'), makeNext());
      const csp = response.headers.get('Content-Security-Policy');
      expect(csp).toContain("form-action 'self'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
    });
  });

  // ---- Admin auth ---------------------------------------------------------

  describe('admin route authentication', () => {
    it('returns 403 for /admin without Cf-Access-Authenticated-User-Email', async () => {
      const response = await (onRequest as MiddlewareFn)(makeContext('/admin'), makeNext());
      expect(response.status).toBe(403);
    });

    it('returns 403 for nested admin routes without the header', async () => {
      const response = await (onRequest as MiddlewareFn)(
        makeContext('/admin/metrics'),
        makeNext(),
      );
      expect(response.status).toBe(403);
    });

    it('does not call next() when auth fails', async () => {
      const spy = makeSpyNext();
      await (onRequest as MiddlewareFn)(makeContext('/admin'), spy.next);
      expect(spy.called()).toBe(false);
    });

    it('allows admin access when Cf-Access-Authenticated-User-Email is in allowlist', async () => {
      process.env.ADMIN_EMAILS = 'james@smagile.co';
      const response = await (onRequest as MiddlewareFn)(
        makeContext('/admin', {
          'Cf-Access-Authenticated-User-Email': 'james@smagile.co',
        }),
        makeNext(),
      );
      expect(response.status).toBe(200);
    });

    it('returns 403 when email is not in allowlist', async () => {
      process.env.ADMIN_EMAILS = 'james@smagile.co';
      const response = await (onRequest as MiddlewareFn)(
        makeContext('/admin', {
          'Cf-Access-Authenticated-User-Email': 'intruder@evil.com',
        }),
        makeNext(),
      );
      expect(response.status).toBe(403);
    });

    it('falls back to OWNER_EMAIL when ADMIN_EMAILS is not set', async () => {
      delete process.env.ADMIN_EMAILS;
      process.env.OWNER_EMAIL = 'owner@smagile.co';
      const response = await (onRequest as MiddlewareFn)(
        makeContext('/admin', {
          'Cf-Access-Authenticated-User-Email': 'owner@smagile.co',
        }),
        makeNext(),
      );
      expect(response.status).toBe(200);
    });

    it('allows admin access from localhost without the header (dev mode)', async () => {
      // import.meta.env.DEV is true in vitest
      const url = new URL('/admin', 'http://localhost:4321');
      const request = new Request(url);
      const response = await (onRequest as MiddlewareFn)({ url, request }, makeNext());
      expect(response.status).toBe(200);
    });

    it('allows admin access from 127.0.0.1 without the header (dev mode)', async () => {
      const url = new URL('/admin', 'http://127.0.0.1:4321');
      const request = new Request(url);
      const response = await (onRequest as MiddlewareFn)({ url, request }, makeNext());
      expect(response.status).toBe(200);
    });
  });

  // ---- CSRF origin validation ---------------------------------------------

  describe('CSRF origin validation', () => {
    it('blocks POST to /admin/api/ with mismatched origin', async () => {
      process.env.ADMIN_EMAILS = 'james@smagile.co';
      const response = await (onRequest as MiddlewareFn)(
        makeContext(
          '/admin/api/data',
          {
            'Cf-Access-Authenticated-User-Email': 'james@smagile.co',
            origin: 'https://evil.com',
            host: 'smagile.co',
          },
          { method: 'POST' },
        ),
        makeNext(),
      );
      expect(response.status).toBe(403);
    });

    it('allows POST to /admin/api/ with matching origin', async () => {
      process.env.ADMIN_EMAILS = 'james@smagile.co';
      const response = await (onRequest as MiddlewareFn)(
        makeContext(
          '/admin/api/data',
          {
            'Cf-Access-Authenticated-User-Email': 'james@smagile.co',
            origin: 'https://smagile.co',
            host: 'smagile.co',
          },
          { method: 'POST' },
        ),
        makeNext(),
      );
      expect(response.status).toBe(200);
    });

    it('allows GET to /admin/api/ without origin check', async () => {
      process.env.ADMIN_EMAILS = 'james@smagile.co';
      const response = await (onRequest as MiddlewareFn)(
        makeContext('/admin/api/data', {
          'Cf-Access-Authenticated-User-Email': 'james@smagile.co',
        }),
        makeNext(),
      );
      expect(response.status).toBe(200);
    });
  });

  // ---- Non-admin routes ---------------------------------------------------

  describe('non-admin routes', () => {
    it('passes through without auth check', async () => {
      const response = await (onRequest as MiddlewareFn)(makeContext('/'), makeNext());
      expect(response.status).toBe(200);
    });

    it('passes through for /about without auth check', async () => {
      const response = await (onRequest as MiddlewareFn)(makeContext('/about'), makeNext());
      expect(response.status).toBe(200);
    });

    it('still applies security headers to non-admin routes', async () => {
      const response = await (onRequest as MiddlewareFn)(makeContext('/blog'), makeNext());
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });
  });
});
