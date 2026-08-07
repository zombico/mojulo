import { readPort, readBearer } from './files';

const DAEMON_HOST_HINT =
  'runtime daemons host is not reachable. Start it with the `mojulo-daemons` bin ' +
  '(MOJULO_DAEMONS=enabled). See docs/app-runtime.md.';

class DaemonHostUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DaemonHostUnavailableError';
    this.code = 'DAEMON_HOST_UNREACHABLE';
  }
}

async function hostRequest(method, pathname, body) {
  const port = readPort();
  const bearer = readBearer();
  if (!port || !bearer) {
    throw new DaemonHostUnavailableError(DAEMON_HOST_HINT);
  }
  let res;
  try {
    res = await fetch(`http://127.0.0.1:${port}${pathname}`, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${bearer}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    throw new DaemonHostUnavailableError(`${DAEMON_HOST_HINT} (${err?.message || err})`);
  }
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || `runtime daemons host returned ${res.status}`);
  }
  return payload;
}

export const RuntimeDaemons = {
  async list() {
    try {
      const out = await hostRequest('GET', '/daemons');
      return out.daemons || [];
    } catch (err) {
      if (err instanceof DaemonHostUnavailableError) return [];
      throw err;
    }
  },

  async status(name) {
    try {
      return await hostRequest('GET', `/daemons/${encodeURIComponent(name)}/status`);
    } catch (err) {
      if (err instanceof DaemonHostUnavailableError) {
        return { name, status: 'unknown' };
      }
      throw err;
    }
  },

  async start(name) {
    return hostRequest('POST', `/daemons/${encodeURIComponent(name)}/start`);
  },

  async stop(name) {
    return hostRequest('POST', `/daemons/${encodeURIComponent(name)}/stop`);
  },

  async restart(name) {
    return hostRequest('POST', `/daemons/${encodeURIComponent(name)}/restart`);
  },

  async reload(name) {
    return hostRequest('POST', `/daemons/${encodeURIComponent(name)}/reload`);
  },
};

export async function bestEffortDaemonReload(name) {
  try {
    await RuntimeDaemons.reload(name);
  } catch (err) {
    if (err instanceof DaemonHostUnavailableError) return { ok: false, reason: 'unreachable' };
    return { ok: false, reason: err?.message || 'reload failed' };
  }
  return { ok: true };
}

export { DaemonHostUnavailableError };
