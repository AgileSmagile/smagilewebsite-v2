-- Replace jsonb-blob schema with flat-column schema to match admin/metrics.ts expectations.
-- The old 004 table (metrics jsonb) was incompatible: CI inserts were failing silently
-- and admin reads were returning empty. The table should be empty.
DROP TABLE IF EXISTS code_health_snapshots;

CREATE TABLE code_health_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  project text NOT NULL DEFAULT 'smagile-website',
  lines_of_code int,
  sloc int,
  lines_of_tests int,
  test_count int,
  tests_passing int,
  tests_failing int,
  test_coverage_pct numeric(5,2),
  lint_errors int,
  lint_warnings int,
  vuln_critical int,
  vuln_high int,
  vuln_moderate int,
  type_safety_any_count int,
  bundle_size_kb numeric(8,2),
  build_time_ms int,
  insertions_30d int,
  deletions_30d int,
  files_changed_30d int,
  last_refactor_date timestamptz,
  todo_fixme_count int,
  raw_data jsonb
);

CREATE INDEX IF NOT EXISTS idx_code_health_project ON code_health_snapshots (project, created_at DESC);

-- Service role (CI pipeline) writes; admin dashboard reads via service role (bypasses RLS)
ALTER TABLE code_health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert snapshots" ON code_health_snapshots
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service role can read snapshots" ON code_health_snapshots
  FOR SELECT TO service_role USING (true);
