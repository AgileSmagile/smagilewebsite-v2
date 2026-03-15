import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://cloudflareinsights.com",
  );

  // Server-side auth check for admin routes
  if (context.url.pathname.startsWith('/admin')) {
    const cfEmail = context.request.headers.get('Cf-Access-Authenticated-User-Email');
    const isLocal = context.url.hostname === 'localhost' || context.url.hostname === '127.0.0.1';
    if (!cfEmail && !isLocal) {
      return new Response('Unauthorised', { status: 403 });
    }
  }

  return response;
});
