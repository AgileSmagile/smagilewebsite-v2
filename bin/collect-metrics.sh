#!/usr/bin/env bash
# collect-metrics.sh — Collects code health metrics for smagile.co (Astro)
# Can run locally or inside a GitHub Action. Outputs JSON to stdout.
set -uo pipefail
trap '' PIPE

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ── 1. Lines of code — raw and SLOC (excluding tests) ────────────────
loc=$(find src -type f \( -name '*.astro' -o -name '*.ts' -o -name '*.tsx' \) \
  ! -name '*.test.ts' ! -name '*.test.tsx' \
  ! -path '*/node_modules/*' ! -path '*/.astro/*' ! -path '*/dist/*' \
  | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
loc=${loc:-0}

# SLOC: non-blank, non-comment lines
sloc=$(find src -type f \( -name '*.astro' -o -name '*.ts' -o -name '*.tsx' \) \
  ! -name '*.test.ts' ! -name '*.test.tsx' \
  ! -path '*/node_modules/*' ! -path '*/.astro/*' ! -path '*/dist/*' \
  -exec cat {} + 2>/dev/null \
  | sed '/^\s*$/d' \
  | sed '/^\s*\/\//d' \
  | sed '/^\s*\*/d' \
  | sed '/^\s*\/\*.*\*\/\s*$/d' \
  | wc -l | awk '{print $1}')
sloc=${sloc:-0}

# ── 2. Lines of tests ────────────────────────────────────────────────
lot=$(find src -type f \( -name '*.test.ts' -o -name '*.test.tsx' \) \
  ! -path '*/node_modules/*' ! -path '*/.astro/*' ! -path '*/dist/*' \
  | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
lot=${lot:-0}

# ── 3. Test count and results (via --outputFile for reliable JSON) ───
TEST_JSON_FILE="/tmp/vitest-results-smagile.json"
rm -f "$TEST_JSON_FILE"
npx vitest run --reporter=json --outputFile="$TEST_JSON_FILE" > /dev/null 2>&1 || true

test_count=0
tests_passing=0
tests_failing=0

if [ -f "$TEST_JSON_FILE" ]; then
  test_count=$(node -e "
    const data = JSON.parse(require('fs').readFileSync('$TEST_JSON_FILE','utf8'));
    console.log(data.numTotalTests || 0);
  " 2>/dev/null || echo "0")
  tests_passing=$(node -e "
    const data = JSON.parse(require('fs').readFileSync('$TEST_JSON_FILE','utf8'));
    console.log(data.numPassedTests || 0);
  " 2>/dev/null || echo "0")
  tests_failing=$(node -e "
    const data = JSON.parse(require('fs').readFileSync('$TEST_JSON_FILE','utf8'));
    console.log(data.numFailedTests || 0);
  " 2>/dev/null || echo "0")
fi

# ── 4. Lint errors/warnings (placeholder — no eslint configured) ─────
lint_errors=0
lint_warnings=0

# ── 5. Dependency vulnerabilities ────────────────────────────────────
audit_json=$(npm audit --json 2>/dev/null || true)
vuln_counts=$(echo "$audit_json" | node -e "
  const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const v = data.metadata?.vulnerabilities || {};
  console.log((v.critical || 0) + ' ' + (v.high || 0) + ' ' + (v.moderate || 0));
" 2>/dev/null || echo "0 0 0")
vuln_critical=$(echo "$vuln_counts" | awk '{print $1}')
vuln_high=$(echo "$vuln_counts" | awk '{print $2}')
vuln_moderate=$(echo "$vuln_counts" | awk '{print $3}')

# ── 6. Type safety score (count of `any` type annotations) ───────────
any_count=$(find src -type f \( -name '*.astro' -o -name '*.ts' -o -name '*.tsx' \) \
  ! -name '*.test.ts' ! -name '*.test.tsx' \
  ! -path '*/node_modules/*' ! -path '*/.astro/*' ! -path '*/dist/*' \
  -exec grep -Ec ':\s*any\b|as\s+any\b|<any>|Array<any>' {} + 2>/dev/null \
  | awk -F: '{s+=$NF} END {print s+0}')
any_count=${any_count:-0}

# ── 7. Build time (Astro build — no bundle size metric) ──────────────
build_start=$(date +%s%N 2>/dev/null || python3 -c "import time; print(int(time.time()*1e9))")
build_output=$(npx astro build 2>&1 || true)
build_end=$(date +%s%N 2>/dev/null || python3 -c "import time; print(int(time.time()*1e9))")
build_time_ms=$(( (build_end - build_start) / 1000000 ))

# Astro doesn't report bundle size the same way as Next.js
bundle_size_kb="null"

# Log build output to stderr for CI debugging
echo "=== BUILD OUTPUT ===" >&2
echo "$build_output" | tail -20 >&2
echo "=== END BUILD OUTPUT ===" >&2

# ── 8. Git change stats (last 30 days) ───────────────────────────────
git_stats=$(git log --shortstat --since='30 days ago' --format='' 2>/dev/null || true)
insertions=$(echo "$git_stats" | awk '{s+=$4} END {print s+0}')
deletions=$(echo "$git_stats" | awk '{s+=$6} END {print s+0}')
files_changed=$(echo "$git_stats" | awk '{s+=$1} END {print s+0}')

# ── 9. Last refactor date ────────────────────────────────────────────
last_refactor=$(git log --grep='[Rr]efactor' -1 --format='%cI' 2>/dev/null || echo "null")
if [ -z "$last_refactor" ]; then
  last_refactor="null"
else
  last_refactor="\"$last_refactor\""
fi

# ── 10. TODO/FIXME/HACK count (all source files including tests) ─────
todo_count=$(find src -type f \( -name '*.astro' -o -name '*.ts' -o -name '*.tsx' \) \
  ! -path '*/node_modules/*' ! -path '*/.astro/*' ! -path '*/dist/*' \
  -print0 | xargs -0 grep -oE 'TODO|FIXME|HACK|XXX' 2>/dev/null \
  | wc -l | awk '{print $1+0}')
todo_count=${todo_count:-0}

# ── 11. Audit detail arrays (for raw_data JSONB) ─────────────────────
SRC_FILES=$(find src -type f \( -name '*.astro' -o -name '*.ts' -o -name '*.tsx' \) \
  ! -name '*.test.ts' ! -name '*.test.tsx' \
  ! -path '*/node_modules/*' ! -path '*/.astro/*' ! -path '*/dist/*')

# 11a. top_files — top 10 largest source files
top_files_raw=$(echo "$SRC_FILES" | xargs wc -l 2>/dev/null \
  | sort -rn | grep -v ' total$' | head -10)
top_files_json=$(echo "$top_files_raw" | awk '
  BEGIN { printf "[" }
  NR > 1 { printf "," }
  { gsub(/"/, "\\\"", $2); printf "{\"path\":\"%s\",\"lines\":%d}", $2, $1 }
  END { printf "]" }
')
top_files_json=${top_files_json:-"[]"}

# 11b. lines_by_directory — top 10 directories by LOC
lines_by_dir_json=$(echo "$SRC_FILES" | xargs wc -l 2>/dev/null \
  | grep -v ' total$' | awk '
  {
    n = split($2, parts, "/")
    if (n >= 3) dir = parts[1] "/" parts[2] "/" parts[3]
    else if (n == 2) dir = parts[1] "/" parts[2]
    else dir = $2
    lines[dir] += $1
  }
  END {
    for (d in lines) printf "%d\t%s\n", lines[d], d
  }' | sort -rn | head -10 | awk '
  BEGIN { printf "[" }
  NR > 1 { printf "," }
  { gsub(/"/, "\\\"", $2); printf "{\"directory\":\"%s\",\"lines\":%d}", $2, $1 }
  END { printf "]" }
')
lines_by_dir_json=${lines_by_dir_json:-"[]"}

# 11c. bloat_files — files over 200 lines (max 15)
bloat_files_json=$(echo "$SRC_FILES" | xargs wc -l 2>/dev/null \
  | sort -rn | grep -v ' total$' \
  | awk '$1 > 200 { print }' | head -15 | awk '
  BEGIN { printf "[" }
  NR > 1 { printf "," }
  { gsub(/"/, "\\\"", $2); printf "{\"path\":\"%s\",\"lines\":%d}", $2, $1 }
  END { printf "]" }
')
bloat_files_json=${bloat_files_json:-"[]"}

# 11d. todo_hotspots — files with most TODO/FIXME/HACK comments (top 10)
todo_hotspots_json=$(echo "$SRC_FILES" | xargs grep -cE '(TODO|FIXME|HACK|XXX)' 2>/dev/null \
  | grep -v ':0$' | sort -t: -k2 -rn | head -10 | awk -F: '
  BEGIN { printf "[" }
  NR > 1 { printf "," }
  { gsub(/"/, "\\\"", $1); printf "{\"path\":\"%s\",\"count\":%d}", $1, $2 }
  END { printf "]" }
')
todo_hotspots_json=${todo_hotspots_json:-"[]"}

# 11e. git_churn — most changed files in last 7 days (top 10)
git_churn_json="[]"
if git rev-parse --git-dir > /dev/null 2>&1; then
  git_churn_json=$(git log --since='7 days ago' --name-only --pretty=format: 2>/dev/null \
    | grep -v '^$' | sort | uniq -c | sort -rn | head -10 | awk '
    BEGIN { printf "[" }
    NR > 1 { printf "," }
    { gsub(/"/, "\\\"", $2); printf "{\"path\":\"%s\",\"changes\":%d}", $2, $1 }
    END { printf "]" }
  ')
  git_churn_json=${git_churn_json:-"[]"}
fi

# 11f. file_type_breakdown — LOC by file extension
file_type_breakdown_json="[]"
ftb_data=""
for ext in astro ts tsx; do
  ext_files=$(echo "$SRC_FILES" | grep "\.$ext$" || true)
  if [ -n "$ext_files" ]; then
    ext_file_count=$(echo "$ext_files" | grep -c . || echo 0)
    if [ "$ext_file_count" -eq 1 ]; then
      ext_lines=$(echo "$ext_files" | xargs wc -l 2>/dev/null | awk '{print $1}')
    else
      ext_lines=$(echo "$ext_files" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
    fi
    ftb_data="${ftb_data}${ext}\t${ext_lines}\t${ext_file_count}\n"
  fi
done
if [ -n "$ftb_data" ]; then
  file_type_breakdown_json=$(printf "%b" "$ftb_data" | grep -v '^$' | awk -F'\t' '
    BEGIN { printf "[" }
    NR > 1 { printf "," }
    { printf "{\"extension\":\".%s\",\"lines\":%d,\"files\":%d}", $1, $2, $3 }
    END { printf "]" }
  ')
  file_type_breakdown_json=${file_type_breakdown_json:-"[]"}
fi

# ── Output JSON ──────────────────────────────────────────────────────
cat <<ENDJSON
{
  "project": "smagile-website",
  "lines_of_code": $loc,
  "sloc": $sloc,
  "lines_of_tests": $lot,
  "test_count": $test_count,
  "tests_passing": $tests_passing,
  "tests_failing": $tests_failing,
  "test_coverage_pct": null,
  "lint_errors": $lint_errors,
  "lint_warnings": $lint_warnings,
  "vuln_critical": $vuln_critical,
  "vuln_high": $vuln_high,
  "vuln_moderate": $vuln_moderate,
  "type_safety_any_count": $any_count,
  "bundle_size_kb": $bundle_size_kb,
  "build_time_ms": $build_time_ms,
  "insertions_30d": $insertions,
  "deletions_30d": $deletions,
  "files_changed_30d": $files_changed,
  "last_refactor_date": $last_refactor,
  "todo_fixme_count": $todo_count,
  "raw_data": {
    "top_files": $top_files_json,
    "lines_by_directory": $lines_by_dir_json,
    "bloat_files": $bloat_files_json,
    "todo_hotspots": $todo_hotspots_json,
    "git_churn": $git_churn_json,
    "file_type_breakdown": $file_type_breakdown_json
  }
}
ENDJSON
