/**
 * Loopback guard for the dashboard (middleware.js). The dashboard binds
 * 127.0.0.1 and has no login by default, so a web page the operator visits
 * could otherwise reach it:
 *   - DNS rebinding: attacker.example re-resolves to 127.0.0.1, and the
 *     browser sends `Host: attacker.example:3001`. Refused unless the Host is
 *     a loopback name (or MOJULO_UI_HOST).
 *   - Cross-site writes: a form or fetch from another site POSTs to
 *     127.0.0.1:3001 (document upload, deploy). Refused for any non-GET
 *     request whose Origin is not the dashboard's own or whose
 *     Sec-Fetch-Site says cross-site.
 * Requests with neither header (curl, server-side fetch, CLI) pass the
 * origin check; the Host check still applies.
 *
 * Edge-runtime safe: no Node imports.
 */

const LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]'];
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// A bind address, never a name a legitimate page is served from (and the
// "0.0.0.0 day" route to localhost), so it is not added from MOJULO_UI_HOST.
const UNSPECIFIED = new Set(['0.0.0.0', '[::]']);

function bracketIpv6(hostname) {
  return hostname.includes(':') && !hostname.startsWith('[') ? `[${hostname}]` : hostname;
}

/** The hostname part of a Host header value: lowercased, port dropped, IPv6 in brackets. */
export function hostnameOf(hostHeader) {
  if (typeof hostHeader !== 'string') return null;
  const value = hostHeader.trim().toLowerCase();
  if (!value) return null;
  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    return end === -1 ? null : value.slice(0, end + 1);
  }
  const colon = value.indexOf(':');
  return colon === -1 ? value : value.slice(0, colon);
}

export function allowedHostnames(env = process.env) {
  const hosts = new Set(LOOPBACK_HOSTNAMES);
  const extra = env.MOJULO_UI_HOST?.trim().toLowerCase();
  if (extra) {
    const name = bracketIpv6(extra);
    if (!UNSPECIFIED.has(name)) hosts.add(name);
  }
  return hosts;
}

/**
 * Null when the request may proceed, else `{ code, error }` for a 403.
 * @param {{ method: string, host?: string|null, origin?: string|null, secFetchSite?: string|null }} req
 */
export function checkDashboardRequest({ method, host, origin, secFetchSite }, env = process.env) {
  const hostname = hostnameOf(host);
  if (!hostname || !allowedHostnames(env).has(hostname)) {
    return {
      code: 'HOST_NOT_ALLOWED',
      error:
        `The dashboard only answers requests addressed to localhost, 127.0.0.1 or [::1]` +
        ` (got Host: ${host || 'none'}). Set MOJULO_UI_HOST to add the address it is served on.`,
    };
  }
  if (SAFE_METHODS.has(String(method).toUpperCase())) return null;

  if (secFetchSite === 'cross-site') {
    return { code: 'CROSS_SITE_REQUEST', error: 'Cross-site requests may not change dashboard state.' };
  }
  if (origin != null && origin !== '') {
    let originHost = null;
    try {
      originHost = origin === 'null' ? null : new URL(origin).host.toLowerCase();
    } catch {
      originHost = null;
    }
    if (originHost !== String(host).trim().toLowerCase()) {
      return {
        code: 'CROSS_SITE_REQUEST',
        error: `Requests from ${origin} may not change dashboard state.`,
      };
    }
  }
  return null;
}
