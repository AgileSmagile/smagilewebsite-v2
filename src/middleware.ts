import { defineMiddleware } from 'astro:middleware';

const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://cloudflareinsights.com",
    "form-action 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
};

function applySecurityHeaders(response: Response): Response {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const hostname = context.url.hostname;
  const isAdmin = pathname.startsWith('/admin');

  // Admin auth check — BEFORE calling next() to prevent handler execution
  if (isAdmin) {
    const isLocal =
      import.meta.env.DEV && (hostname === 'localhost' || hostname === '127.0.0.1');

    if (!isLocal) {
      const cfEmail = context.request.headers.get('Cf-Access-Authenticated-User-Email');
      const cfJwt = context.request.headers.get('Cf-Access-Jwt-Assertion');
      const isApiRoute = pathname.startsWith('/admin/api/');

      // Service tokens (validated by CF Access) produce a JWT but no email.
      // Allow these on API routes only.
      const isServiceAuth = isApiRoute && cfJwt && !cfEmail;

      if (!cfEmail && !isServiceAuth) {
        return new Response('Unauthorised', { status: 403 });
      }

      // For email-based auth, verify against allowlist
      if (cfEmail && !isServiceAuth) {
        const adminEmails = (
          process.env.ADMIN_EMAILS ||
          process.env.OWNER_EMAIL ||
          ''
        )
          .split(',')
          .map((e) => e.trim().toLowerCase());

        if (!adminEmails.includes(cfEmail.toLowerCase())) {
          return new Response('Forbidden', { status: 403 });
        }
      }
    }

    // CSRF origin validation for all mutating admin requests
    const method = context.request.method;
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const origin = context.request.headers.get('origin');
      const referer = context.request.headers.get('referer');
      const host = context.request.headers.get('host');

      // Determine the source hostname from Origin or Referer
      const sourceHeader = origin || referer;
      if (sourceHeader && host) {
        const sourceHost = new URL(sourceHeader).hostname;
        const requestHost = host.split(':')[0];
        if (sourceHost !== requestHost) {
          return new Response('Invalid origin', { status: 403 });
        }
      } else if (!sourceHeader) {
        // Neither Origin nor Referer present; reject the request
        return new Response('Missing origin', { status: 403 });
      }
    }
  }

  const response = await next();
  return applySecurityHeaders(response);
});
