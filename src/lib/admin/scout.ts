import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface ScoutInsight {
  id: string;
  sourceUrl: string;
  selectedText: string;
  companyName: string;
  notes: string;
  timestamp: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const INSIGHTS_FILE = path.join(DATA_DIR, 'scout-insights.json');

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function writeInsights(insights: ScoutInsight[]): void {
  ensureDataDir();
  const tmp = `${INSIGHTS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(insights, null, 2), 'utf-8');
  fs.renameSync(tmp, INSIGHTS_FILE);
}

export function getInsights(): ScoutInsight[] {
  ensureDataDir();

  if (!fs.existsSync(INSIGHTS_FILE)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(INSIGHTS_FILE, 'utf-8');
    return JSON.parse(raw) as ScoutInsight[];
  } catch {
    return [];
  }
}

export function addInsight(
  input: Omit<ScoutInsight, 'id' | 'timestamp'>,
): ScoutInsight {
  const insights = getInsights();

  const insight: ScoutInsight = {
    id: crypto.randomUUID(),
    sourceUrl: input.sourceUrl,
    selectedText: input.selectedText,
    companyName: input.companyName,
    notes: input.notes,
    timestamp: new Date().toISOString(),
  };

  insights.unshift(insight);
  writeInsights(insights);

  return insight;
}

export function deleteInsight(id: string): boolean {
  const insights = getInsights();
  const index = insights.findIndex((i) => i.id === id);

  if (index === -1) return false;

  insights.splice(index, 1);
  writeInsights(insights);

  return true;
}
