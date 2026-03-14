import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FA_API = 'https://api.freeagent.com/v2';
const FA_AUTH_URL = 'https://api.freeagent.com/v2/approve_app';
const FA_TOKEN_URL = 'https://api.freeagent.com/v2/token_endpoint';

const TOKEN_PATH = join(process.cwd(), '.freeagent-tokens.json');

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface FreeAgentCompany {
  name: string;
  url: string;
  currency: string;
}

interface FreeAgentBankAccount {
  url: string;
  name: string;
  type: string;
  current_balance: string;
  currency: string;
}

interface FreeAgentInvoice {
  url: string;
  reference: string;
  contact: string;
  dated_on: string;
  due_on: string;
  total_value: string;
  paid_value: string;
  status: string;
  currency: string;
}

interface FreeAgentExpense {
  url: string;
  category: string;
  description: string;
  dated_on: string;
  gross_value: string;
  currency: string;
}

interface FreeAgentBill {
  url: string;
  contact: string;
  reference: string;
  dated_on: string;
  due_on: string;
  total_value: string;
  paid_value: string;
  status: string;
}

// --- Token storage ---

function readTokens(): TokenData | null {
  try {
    if (!existsSync(TOKEN_PATH)) return null;
    const raw = readFileSync(TOKEN_PATH, 'utf-8');
    const data = JSON.parse(raw) as TokenData;
    if (!data.access_token || !data.refresh_token) return null;
    return data;
  } catch {
    return null;
  }
}

function writeTokens(tokens: TokenData): void {
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), 'utf-8');
}

export function deleteTokens(): boolean {
  try {
    if (existsSync(TOKEN_PATH)) {
      unlinkSync(TOKEN_PATH);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isConnected(): boolean {
  return readTokens() !== null;
}

// --- OAuth flow ---

function getClientId(): string {
  // process.env for SSR runtime access — import.meta.env is build-time only
  return process.env.FREEAGENT_CLIENT_ID ?? '';
}

function getClientSecret(): string {
  return process.env.FREEAGENT_CLIENT_SECRET ?? '';
}

export function getAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getClientId(),
    redirect_uri: redirectUri,
  });
  return `${FA_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<boolean> {
  try {
    const res = await fetch(FA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: getClientId(),
        client_secret: getClientSecret(),
      }),
    });

    if (!res.ok) {
      console.error('[FreeAgent] Token exchange failed:', res.status, await res.text());
      return false;
    }

    const body = await res.json();
    const tokens: TokenData = {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expires_at: Date.now() + (body.expires_in ?? 3600) * 1000,
    };
    writeTokens(tokens);
    return true;
  } catch (err) {
    console.error('[FreeAgent] Token exchange error:', err);
    return false;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const tokens = readTokens();
  if (!tokens) return null;

  try {
    const res = await fetch(FA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: getClientId(),
        client_secret: getClientSecret(),
      }),
    });

    if (!res.ok) {
      console.error('[FreeAgent] Token refresh failed:', res.status, await res.text());
      return null;
    }

    const body = await res.json();
    const updated: TokenData = {
      access_token: body.access_token,
      refresh_token: body.refresh_token ?? tokens.refresh_token,
      expires_at: Date.now() + (body.expires_in ?? 3600) * 1000,
    };
    writeTokens(updated);
    return updated.access_token;
  } catch (err) {
    console.error('[FreeAgent] Token refresh error:', err);
    return null;
  }
}

// --- Authenticated API requests ---

async function getAccessToken(): Promise<string | null> {
  const tokens = readTokens();
  if (!tokens) return null;

  // Refresh if expired or within 60 seconds of expiry
  if (Date.now() >= tokens.expires_at - 60_000) {
    return refreshAccessToken();
  }
  return tokens.access_token;
}

async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T | null> {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    let url = `${FA_API}${path}`;
    if (params) {
      const qs = new URLSearchParams(params);
      url += `?${qs.toString()}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[FreeAgent] GET ${path} failed:`, res.status);
      return null;
    }

    return (await res.json()) as T;
  } catch (err) {
    console.error(`[FreeAgent] GET ${path} error:`, err);
    return null;
  }
}

// --- Public API functions (read-only) ---

export async function getCompany(): Promise<FreeAgentCompany | null> {
  const data = await apiGet<{ company: FreeAgentCompany }>('/company');
  return data?.company ?? null;
}

export async function getBankAccounts(): Promise<FreeAgentBankAccount[]> {
  const data = await apiGet<{ bank_accounts: FreeAgentBankAccount[] }>('/bank_accounts');
  return data?.bank_accounts ?? [];
}

export async function getInvoices(params?: Record<string, string>): Promise<FreeAgentInvoice[]> {
  const data = await apiGet<{ invoices: FreeAgentInvoice[] }>('/invoices', params);
  const invoices = data?.invoices ?? [];
  console.log(`[FreeAgent] Invoices: ${invoices.length} returned, statuses: ${invoices.map(i => i.status).join(', ')}`);
  return invoices;
}

export async function getExpenses(params?: Record<string, string>): Promise<FreeAgentExpense[]> {
  const data = await apiGet<{ expenses: FreeAgentExpense[] }>('/expenses', params);
  const expenses = data?.expenses ?? [];
  console.log(`[FreeAgent] Expenses: ${expenses.length} returned`);
  return expenses;
}

export async function getBills(params?: Record<string, string>): Promise<FreeAgentBill[]> {
  const data = await apiGet<{ bills: FreeAgentBill[] }>('/bills', params);
  return data?.bills ?? [];
}

export async function getProfitAndLoss(from: string, to: string): Promise<{ income: number; expenses: number; profit: number } | null> {
  try {
    const [invoices, expenses] = await Promise.all([
      getInvoices({ from_date: from, to_date: to, view: 'all' }),
      getExpenses({ from_date: from, to_date: to }),
    ]);

    const income = invoices.reduce((sum, inv) => sum + parseFloat(inv.paid_value || '0'), 0);
    const expenseTotal = expenses.reduce((sum, exp) => sum + Math.abs(parseFloat(exp.gross_value || '0')), 0);

    return {
      income,
      expenses: expenseTotal,
      profit: income - expenseTotal,
    };
  } catch (err) {
    console.error('[FreeAgent] P&L calculation error:', err);
    return null;
  }
}
