/**
 * Test setup — sets dummy environment variables so modules that read
 * process.env at import time don't fail or warn during tests.
 *
 * Variable names match .env.example.
 */

process.env.PUBLIC_CF_ANALYTICS_TOKEN = 'test-cf-analytics-token';
process.env.PUBLIC_GA_MEASUREMENT_ID = 'G-TESTID1234';
process.env.FREEAGENT_CLIENT_ID = 'test-freeagent-client-id';
process.env.FREEAGENT_CLIENT_SECRET = 'test-freeagent-client-secret';
process.env.SUPABASE_URL = 'https://test-project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.BUSINESSMAP_API_KEY = 'test-businessmap-api-key';
