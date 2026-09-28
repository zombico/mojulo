/**
 * Upstream registry fetcher for `check_for_updates`: the npm registry only.
 * (Until 3.0 a second fetcher listed the chatbot image's tags on GHCR; the
 * image left with the chatbot factory, so core has no GHCR reach.)
 *
 * The call is best-effort: a network blip or registry 5xx returns
 * `{ version: null, error: 'reason' }` rather than throwing. The tool's
 * report should still surface the local state even when the upstream
 * lookup fails.
 *
 * No caching across calls in v1 — the tool is on-demand and infrequent.
 */

const NPM_LATEST_URL = (pkg) =>
  `https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`;

const DEFAULT_TIMEOUT_MS = 4000;

async function fetchWithTimeout(url, { headers, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Look up the `latest` dist-tag for an npm package.
 * Returns `{ version: string | null, error?: string }`.
 */
export async function fetchLatestNpmVersion(pkg, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  try {
    const res = await fetchWithTimeout(NPM_LATEST_URL(pkg), {
      headers: { accept: 'application/json' },
      timeoutMs,
    });
    if (!res.ok) {
      return { version: null, error: `npm registry HTTP ${res.status}` };
    }
    const body = await res.json();
    if (typeof body?.version !== 'string') {
      return { version: null, error: 'npm registry response missing .version' };
    }
    return { version: body.version };
  } catch (err) {
    const reason = err?.name === 'AbortError' ? 'npm registry timeout' : `npm registry error: ${err?.message || err}`;
    return { version: null, error: reason };
  }
}

/**
 * Compare two semver strings (`X.Y.Z`). Returns negative if `a < b`,
 * positive if `a > b`, zero if equal. Tolerates non-matching shapes by
 * coercing missing components to 0.
 */
export function compareSemver(a, b) {
  const pa = String(a || '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
