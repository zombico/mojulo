import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

import { startDaemonServer as startAppRuntimeServer } from '@/lib/runners/daemon/server';
import {
  startScheduler,
  stopScheduler,
  reload as reloadScheduler,
  isSchedulerRunning,
} from '@/lib/triggers/scheduler';
import { ensureBearer, ensureRuntimeDirs, writePort } from './files.js';

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    let tooBig = false;
    req.on('data', (chunk) => {
      buf += chunk;
      if (buf.length > 1_000_000) {
        tooBig = true;
        req.destroy();
      }
    });
    req.on('end', () => {
      if (tooBig) return reject(new Error('request body too large'));
      if (!buf.trim()) return resolve({});
      try {
        resolve(JSON.parse(buf));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function resolveDaemonEnabled(envVar, defaultEnabled = true) {
  const raw = process.env[envVar];
  if (!raw) return { enabled: defaultEnabled, reason: null };
  if (raw === 'enabled') return { enabled: true, reason: null };
  if (raw === 'disabled') return { enabled: false, reason: `${envVar}=disabled` };
  console.warn(
    `[daemons] ${envVar}='${raw}' not recognized; expected 'enabled' or 'disabled'. Treating as disabled.`,
  );
  return { enabled: false, reason: `${envVar}='${raw}' not recognized` };
}

function formatDaemonInfo(daemon) {
  const info = { name: daemon.name, status: daemon.status() };
  if (daemon.detail) {
    const detail = daemon.detail();
    if (detail) info.detail = detail;
  }
  return info;
}

export async function startDaemonHostServer(opts = {}) {
  ensureRuntimeDirs();
  const bearer = ensureBearer();
  const defaultEnabled = opts.defaultEnabled ?? true;

  let appRuntimeHandle = null;
  const schedulerGate = resolveDaemonEnabled('MOJULO_TRIGGER_RUNTIME', defaultEnabled);
  const appRuntimeGate = resolveDaemonEnabled('MOJULO_APP_RUNTIME', defaultEnabled);

  const daemons = new Map();

  const schedulerDaemon = {
    name: 'scheduler',
    enabled: schedulerGate.enabled,
    disabledReason: schedulerGate.reason,
    async start() {
      if (!this.enabled) {
        throw new Error(`scheduler is disabled (${this.disabledReason || 'unset'})`);
      }
      startScheduler();
    },
    async stop() {
      await stopScheduler();
    },
    async reload() {
      if (!this.enabled) {
        throw new Error(`scheduler is disabled (${this.disabledReason || 'unset'})`);
      }
      reloadScheduler();
    },
    status() {
      if (!this.enabled) return 'stopped';
      return isSchedulerRunning() ? 'running' : 'stopped';
    },
    detail() {
      if (!this.enabled && this.disabledReason) {
        return `disabled (${this.disabledReason})`;
      }
      return null;
    },
  };

  const appRuntimeDaemon = {
    name: 'app-runtime',
    enabled: appRuntimeGate.enabled,
    disabledReason: appRuntimeGate.reason,
    async start() {
      if (!this.enabled) {
        throw new Error(`app-runtime is disabled (${this.disabledReason || 'unset'})`);
      }
      if (appRuntimeHandle) return;
      appRuntimeHandle = await startAppRuntimeServer();
    },
    async stop() {
      if (!appRuntimeHandle) return;
      await appRuntimeHandle.close();
      appRuntimeHandle = null;
    },
    status() {
      if (!this.enabled) return 'stopped';
      return appRuntimeHandle ? 'running' : 'stopped';
    },
    detail() {
      if (!this.enabled && this.disabledReason) {
        return `disabled (${this.disabledReason})`;
      }
      if (appRuntimeHandle?.port) {
        return `listening on 127.0.0.1:${appRuntimeHandle.port}`;
      }
      return null;
    },
  };

  daemons.set(schedulerDaemon.name, schedulerDaemon);
  daemons.set(appRuntimeDaemon.name, appRuntimeDaemon);

  async function startDaemonSafely(daemon) {
    if (!daemon.enabled) return;
    try {
      await daemon.start();
    } catch (err) {
      console.warn(`[daemons] failed to start ${daemon.name}:`, err?.message || err);
    }
  }

  for (const daemon of daemons.values()) {
    await startDaemonSafely(daemon);
  }

  const handler = async (req, res) => {
    const header = req.headers['authorization'] || '';
    const presented = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    if (!safeEqual(presented, bearer)) {
      return send(res, 401, { error: 'unauthorized' });
    }

    let url;
    try {
      url = new URL(req.url, 'http://127.0.0.1');
    } catch {
      return send(res, 400, { error: 'bad request target' });
    }
    const { pathname } = url;
    const method = req.method;

    if (method === 'GET' && pathname === '/health') {
      return send(res, 200, { ok: true });
    }

    if (method === 'GET' && pathname === '/daemons') {
      const list = Array.from(daemons.values()).map(formatDaemonInfo);
      return send(res, 200, { daemons: list });
    }

    const parts = pathname.split('/').filter(Boolean);
    if (parts[0] !== 'daemons' || parts.length !== 3) {
      return send(res, 404, { error: 'not found' });
    }
    const name = decodeURIComponent(parts[1] || '');
    const action = parts[2];
    const daemon = daemons.get(name);
    if (!daemon) {
      return send(res, 404, { error: `unknown daemon '${name}'` });
    }

    try {
      if (method === 'GET' && action === 'status') {
        return send(res, 200, formatDaemonInfo(daemon));
      }

      if (method === 'POST') {
        await readJsonBody(req);
        if (action === 'start') {
          await daemon.start();
          return send(res, 200, formatDaemonInfo(daemon));
        }
        if (action === 'stop') {
          await daemon.stop();
          return send(res, 200, formatDaemonInfo(daemon));
        }
        if (action === 'restart') {
          await daemon.stop();
          await daemon.start();
          return send(res, 200, formatDaemonInfo(daemon));
        }
        if (action === 'reload') {
          if (typeof daemon.reload !== 'function') {
            return send(res, 400, { error: `daemon '${name}' does not support reload` });
          }
          await daemon.reload();
          return send(res, 200, { ...formatDaemonInfo(daemon), reloaded: true });
        }
      }
    } catch (err) {
      return send(res, 400, { error: err?.message || String(err) });
    }

    return send(res, 404, { error: 'not found' });
  };

  const requestedPort = opts.port ?? 0;
  const server = http.createServer(handler);

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(Number.isFinite(requestedPort) ? requestedPort : 0, '127.0.0.1', resolve);
  });

  const { port } = server.address();
  writePort(port);

  const close = async () => {
    await Promise.allSettled([
      schedulerDaemon.stop(),
      appRuntimeDaemon.stop(),
    ]);
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
  };

  return { server, port, close };
}
