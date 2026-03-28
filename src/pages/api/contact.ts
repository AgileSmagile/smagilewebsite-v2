import type { APIRoute } from 'astro';

export const prerender = false;

/** Rate limit: max 3 submissions per IP per 15 minutes. */
const submissions = new Map<string, number[]>();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_SUBMISSIONS = 3;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (submissions.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  submissions.set(ip, timestamps);
  return timestamps.length >= MAX_SUBMISSIONS;
}

function recordSubmission(ip: string): void {
  const timestamps = submissions.get(ip) || [];
  timestamps.push(Date.now());
  submissions.set(ip, timestamps);
}

const MAX_LENGTH = {
  name: 100,
  email: 254,
  subject: 200,
  message: 5000,
} as const;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const contentType = request.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return new Response(JSON.stringify({ error: 'Invalid content type' }), { status: 400 });
  }

  const ip = clientAddress || 'unknown';
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: 'Too many submissions. Please try again later.' }), { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();

  // Validation
  const errors: string[] = [];
  if (!name) errors.push('Name is required');
  if (name.length > MAX_LENGTH.name) errors.push(`Name must be under ${MAX_LENGTH.name} characters`);
  if (!email) errors.push('Email is required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Please enter a valid email address');
  if (email.length > MAX_LENGTH.email) errors.push(`Email must be under ${MAX_LENGTH.email} characters`);
  if (subject.length > MAX_LENGTH.subject) errors.push(`Subject must be under ${MAX_LENGTH.subject} characters`);
  if (!message) errors.push('Message is required');
  if (message.length > MAX_LENGTH.message) errors.push(`Message must be under ${MAX_LENGTH.message} characters`);

  // Honeypot: if a hidden field is filled, silently succeed (bot trap)
  if (body.website) {
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  if (errors.length > 0) {
    return new Response(JSON.stringify({ error: errors[0] }), { status: 400 });
  }

  recordSubmission(ip);

  // Log the enquiry server-side for now.
  // A future enhancement could forward to email via an API (e.g. Resend, Postmark).
  console.log('[Contact] New enquiry:', {
    name,
    email,
    subject: subject || '(no subject)',
    messageLength: message.length,
    ip,
    timestamp: new Date().toISOString(),
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
