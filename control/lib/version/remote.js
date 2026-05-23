/**
 * Upstream registry fetchers for `check_for_updates`.
 *
 * Both calls are best-effort: a network blip or registry 5xx returns
 * `{ version: null, error: 'reason' }` rather than throwing. The tool's
 * report should still surface the local state even when the upstream
 * lookup fails.
 *
 * No caching across calls in v1 — the tool is on-demand and infrequent.
 */

const NPM_LATEST_URL = (pkg) =>
  `https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`;

// GHCR exposes the docker v2 registry API at the same hostname, but tag
// listing requires an anonymous bearer token first.
const GHCR_TOKEN_URL = (repo) =>
  `https://ghcr.io/token?scope=repository:${repo}:pull&service=ghcr.io`;
const GHCR_TAGS_URL = (repo) => `https://ghcr.io/v2/${repo}/tags/list`;

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
 * Look up the newest semver-shaped tag (`X.Y.Z`) for a GHCR repository like
 * `zombico/mojulo-bot`. Pre-releases and `latest` are ignored — we only care
 * about the kind of tag the control plane actually pins.
 * Returns `{ tag: string | null, error?: string }`.
 */
export async function fetchLatestGhcrTag(repo, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  try {
    const tokenRes = await fetchWithTimeout(GHCR_TOKEN_URL(repo), {
      headers: { accept: 'application/json' },
      timeoutMs,
    });
    if (!tokenRes.ok) {
      return { tag: null, error: `ghcr token HTTP ${tokenRes.status}` };
    }
    const tokenBody = await tokenRes.json();
    const token = tokenBody?.token;
    if (!token) {
      return { tag: null, error: 'ghcr token missing from response' };
    }

    const tagsRes = await fetchWithTimeout(GHCR_TAGS_URL(repo), {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
      },
      timeoutMs,
    });
    if (!tagsRes.ok) {
      return { tag: null, error: `ghcr tags HTTP ${tagsRes.status}` };
    }
    const tagsBody = await tagsRes.json();
    const tags = Array.isArray(tagsBody?.tags) ? tagsBody.tags : [];
    const semver = tags.filter((t) => /^\d+\.\d+\.\d+$/.test(t));
    if (semver.length === 0) {
      return { tag: null, error: 'ghcr response had no semver tags' };
    }
    semver.sort(compareSemverDesc);
    return { tag: semver[0] };
  } catch (err) {
    const reason = err?.name === 'AbortError' ? 'ghcr timeout' : `ghcr error: ${err?.message || err}`;
    return { tag: null, error: reason };
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

function compareSemverDesc(a, b) {
  return compareSemver(b, a);
}
