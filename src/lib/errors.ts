/**
 * Turning whatever was thrown into something readable.
 *
 * `e instanceof Error` is the obvious test and it is wrong here. Supabase throws
 * plain objects -- {message, details, hint, code} -- which fail that test, so
 * every one of them fell through to a hardcoded "Could not load." That is the
 * one moment the message matters, and it was the one moment it was discarded.
 *
 * The code is included because it is what actually identifies the fault:
 * 42501 is permission denied, PGRST301 is a dead token, 42P01 is a missing
 * table. "Could not load" identifies nothing.
 */
export function errText(e: unknown, fallback = 'Something went wrong.'): string {
  if (!e) return fallback;
  if (typeof e === 'string') return e;

  const o = e as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
  const parts: string[] = [];

  if (typeof o.message === 'string' && o.message) parts.push(o.message);
  if (typeof o.details === 'string' && o.details && o.details !== o.message) {
    parts.push(o.details);
  }
  if (typeof o.hint === 'string' && o.hint) parts.push(o.hint);

  const text = parts.join(' — ') || fallback;
  return typeof o.code === 'string' && o.code ? `${text} [${o.code}]` : text;
}

/**
 * Is this a dead session rather than a real failure?
 *
 * PGRST301 is a rejected JWT; 401 covers a refresh token that has expired or
 * been revoked. Both mean the same thing to a person: sign in again. Matched on
 * the code rather than the wording, which changes between versions.
 */
export function isAuthFailure(e: unknown): boolean {
  const o = e as { code?: unknown; status?: unknown; message?: unknown };
  if (o?.code === 'PGRST301' || o?.status === 401) return true;
  const m = typeof o?.message === 'string' ? o.message.toLowerCase() : '';
  return m.includes('jwt expired')
    || m.includes('invalid refresh token')
    || m.includes('refresh token not found');
}
