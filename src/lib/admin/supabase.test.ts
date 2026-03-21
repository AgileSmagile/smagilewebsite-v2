import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Supabase client library so we don't make real HTTP calls
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}));

describe('getSupabaseAdmin', () => {
  beforeEach(async () => {
    // Reset the cached singleton between tests by re-importing a fresh module
    vi.resetModules();
  });

  it('returns a Supabase client when environment variables are set', async () => {
    process.env.SUPABASE_URL = 'https://test-project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    const { getSupabaseAdmin } = await import('./supabase');
    const client = getSupabaseAdmin();
    expect(client).not.toBeNull();
  });

  it('returns null when SUPABASE_URL is missing', async () => {
    const originalUrl = process.env.SUPABASE_URL;
    delete process.env.SUPABASE_URL;

    const { getSupabaseAdmin } = await import('./supabase');
    const client = getSupabaseAdmin();
    expect(client).toBeNull();

    // Restore
    process.env.SUPABASE_URL = originalUrl;
  });

  it('returns null when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { getSupabaseAdmin } = await import('./supabase');
    const client = getSupabaseAdmin();
    expect(client).toBeNull();

    // Restore
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  });

  it('returns the same client instance on subsequent calls (singleton)', async () => {
    process.env.SUPABASE_URL = 'https://test-project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    const { getSupabaseAdmin } = await import('./supabase');
    const first = getSupabaseAdmin();
    const second = getSupabaseAdmin();
    expect(first).toBe(second);
  });

  it('calls createClient with the correct URL and key', async () => {
    process.env.SUPABASE_URL = 'https://test-project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    const { createClient } = await import('@supabase/supabase-js');
    const { getSupabaseAdmin } = await import('./supabase');
    getSupabaseAdmin();

    expect(createClient).toHaveBeenCalledWith(
      'https://test-project.supabase.co',
      'test-service-role-key',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  });
});
