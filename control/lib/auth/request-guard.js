/**
 * Loopback guard for the dashboard (middleware.js). The dashboard binds
 * 127.0.0.1 and has no login by default, so a web page the operator visits
 * could otherwise reach it:
 *   - DNS rebinding: attacker.example re-resolves to 127.0.0.1, and the
 *     browser sends `Host: attacker.example:3001`. Refused unless the Host is
 *     a loopback name, MOJULO_UI_HOST, or a name in MOJULO_UI_ALLOWED_HOSTS.
 *   - Cross-site writes: a form or fetch from another site POSTs to
 *     127.0.0.1:3001 (document upload, deploy). Refused for any non-GET
 *     request whose Origin is not the dashboard's own or whose
 *     Sec-Fetch-Site says cross-site.
 * Requests with neither header (curl, server-side fetch, CLI) pass the
 * origin check; the Host check still applies.
 *
 * Two variables, because they answer different questions. MOJULO_UI_HOST is
 * the address the server binds (scripts/ui-launch.mjs) and is trusted as a
 * Host too, unless it is an unspecified address. MOJULO_UI_ALLOWED_HOSTS is a
 * comma-separated list of names the dashboard is reached by and is never
 * bound: a reverse proxy's or tunnel's hostname, or a LAN address while bound
 * to 0.0.0.0. A write whose Origin names one of those passes too, so a proxy
 * that rewrites Host to 127.0.0.1 (nginx's default) still allows writes.
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

/** The MOJULO_UI_ALLOWED_HOSTS names: comma-separated, a port or scheme dropped, unspecified addresses ignored. */
export function extraAllowedHostnames(env = process.env) {
  const names = new Set();
  for (const raw of String(env.MOJULO_UI_ALLOWED_HOSTS || '').split(',')) {
    let value = raw.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/\/.*$/, '');
    // A bare IPv6 address has colons but no port; bracket it before hostnameOf reads a port off it.
    if ((value.match(/:/g) || []).length > 1 && !value.startsWith('[')) value = `[${value}]`;
    const name = hostnameOf(value);
    if (name && !UNSPECIFIED.has(name)) names.add(name);
  }
  return names;
}

export function allowedHostnames(env = process.env) {
  const hosts = new Set([...LOOPBACK_HOSTNAMES, ...extraAllowedHostnames(env)]);
  const bind = env.MOJULO_UI_HOST?.trim().toLowerCase();
  if (bind) {
    const name = bracketIpv6(bind);
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
        `The dashboard only answers requests addressed to localhost, 127.0.0.1, [::1], MOJULO_UI_HOST` +
        ` or a name in MOJULO_UI_ALLOWED_HOSTS (got Host: ${host || 'none'}). To reach it by another name` +
        ` (a reverse proxy, a tunnel, a LAN address while bound to 0.0.0.0), add that name to` +
        ` MOJULO_UI_ALLOWED_HOSTS (comma-separated) and restart the dashboard; MOJULO_UI_HOST is the address it binds.`,
    };
  }
  if (SAFE_METHODS.has(String(method).toUpperCase())) return null;

  if (secFetchSite === 'cross-site') {
    return { code: 'CROSS_SITE_REQUEST', error: 'Cross-site requests may not change dashboard state.' };
  }
  if (origin != null && origin !== '') {
    let originHost = null;
    let originName = null;
    try {
      if (origin !== 'null') {
        const url = new URL(origin);
        originHost = url.host.toLowerCase();
        originName = hostnameOf(url.host);
      }
    } catch {
      originHost = null;
    }
    const sameHost = originHost !== null && originHost === String(host).trim().toLowerCase();
    // Only the operator's named hosts, not the loopback names: another port on
    // localhost is another origin.
    if (!sameHost && !(originName && extraAllowedHostnames(env).has(originName))) {
      return {
        code: 'CROSS_SITE_REQUEST',
        error: `Requests from ${origin} may not change dashboard state.`,
      };
    }
  }
  return null;
}
