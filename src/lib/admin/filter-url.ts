/**
 * Build a URL preserving current filter params but overriding specified ones.
 * Default values are omitted to keep URLs clean.
 */
export function buildFilterUrl(
  basePath: string,
  currentParams: Record<string, string>,
  defaults: Record<string, string>,
  overrides: Record<string, string>,
): string {
  const merged = { ...currentParams, ...overrides };
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(merged)) {
    if (defaults[key] === value) continue;
    params.set(key, value);
  }

  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
