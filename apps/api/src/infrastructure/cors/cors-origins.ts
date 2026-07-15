/**
 * Parses the comma-separated `CORS_ORIGINS` env var into an allow-list of
 * origins for `app.enableCors`. An unset/empty/blank value resolves to an
 * empty array — the caller must treat that as "no origins allowed" (e.g.
 * `origin: false`), never as "allow every origin" (`origin: true`), per the
 * project's Security rules.
 */
export function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/** Resolves the parsed allow-list directly from `process.env.CORS_ORIGINS`. */
export function resolveCorsOrigins(): string[] {
  return parseCorsOrigins(process.env.CORS_ORIGINS);
}
