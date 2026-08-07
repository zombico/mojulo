/**
 * App-runtime daemon — HTTP face over the runner engine.
 *
 * Substrate, not a primitive: invisible background machinery sitting alongside
 * the trigger scheduler. The MCP `start_app` / `stop_app` tools become thin RPC
 * clients (lib/runners/local.js) over this server's loopback HTTP API. Owning
 * the engine in a standalone process is what lets app lifecycle survive a
 * control-plane restart — see daemon/reconcile.js.
 *
 * Security posture (single-user, self-hosted):
 *   - Binds 127.0.0.1 only. Never 0.0.0.0.
 *   - Bearer auth on every request; bearer file is 0600 (daemon/files.js).
 *   - The /start endpoint spawns `npm start` in a caller-supplied directory —
 *     effectively RCE if exposed. Loopback + bearer are the primary guards;
 *     MOJULO_APP_ROOT (if set) additionally rejects artifact paths outside it.
 *
 * Endpoints (all JSON):
 *   GET  /health          → { ok: true }
 *   GET  /list            → { running: [...] }
 *   GET  /status/:ref     → { ...status }
 *   POST /start           → { runningRef, url, mcpUrl, inventoryToolsRegistered }
 *   POST /stop            → { stopped, reason? }
 *   POST /reset           → { reset: true }   (test seam, gated)
 *
 * `startDaemonServer()` is used both by the bin (control/bin/app-runtime.js)
 * and by tests, which run it in-process on an ephemeral port.
 */

import http from 'node:http';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';

import { RunnerEngine } from '@/lib/runners/engine';
import { ensureBearer, ensureRuntimeDirs, writePort } from './files.js';
import { reconcile } from './reconcile.js';

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

// If MOJULO_APP_ROOT is set, the artifact must live inside it. Defends the
// spawn endpoint against being pointed at an arbitrary directory even if the
// bearer leaks. When unset, only the engine's existsSync check applies.
function assertArtifactAllowed(artifactRef, appRoot) {
  if (!appRoot) return;
  const root = path.resolve(appRoot);
  const target = path.resolve(artifactRef);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error(`artifact_ref '${artifactRef}' is outside MOJULO_APP_ROOT`);
  }
}

function buildHandler({ bearer, appRoot, allowReset }) {
  return async function handler(req, res) {
    // Auth on every request.
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

    try {
      if (method === 'GET' && pathname === '/health') {
        return send(res, 200, { ok: true });
      }

      if (method === 'GET' && pathname === '/list') {
        return send(res, 200, { running: RunnerEngine.list() });
      }

      if (method === 'GET' && pathname.startsWith('/status/')) {
        const ref = decodeURIComponent(pathname.slice('/status/'.length));
        return send(res, 200, RunnerEngine.status(ref));
      }

      if (method === 'POST' && pathname === '/start') {
        const body = await readJsonBody(req);
        assertArtifactAllowed(body.artifactRef, appRoot);
        const out = await RunnerEngine.start({
          artifactRef: body.artifactRef,
          appName: body.appName,
          materializationRef: body.materializationRef,
          declaredPurpose: body.declaredPurpose,
          serverName: body.serverName,
          ...(Number.isFinite(body.timeoutMs) ? { timeoutMs: body.timeoutMs } : {}),
        });
        return send(res, 200, out);
      }

      if (method === 'POST' && pathname === '/stop') {
        const body = await readJsonBody(req);
        if (!body.runningRef || typeof body.runningRef !== 'string') {
          return send(res, 400, { error: 'stop requires { runningRef }' });
        }
        const out = await RunnerEngine.stop(body.runningRef);
        return send(res, 200, out);
      }

      if (method === 'POST' && pathname === '/reset') {
        if (!allowReset) return send(res, 404, { error: 'not found' });
        RunnerEngine._reset();
        return send(res, 200, { reset: true });
      }

      return send(res, 404, { error: 'not found' });
    } catch (err) {
      return send(res, 400, { error: err?.message || String(err) });
    }
  };
}

/**
 * Boot the daemon: mint/read bearer, run reconcile, bind the HTTP server on
 * 127.0.0.1, advertise the chosen port via the port file.
 *
 * @param {object} [opts]
 * @param {number} [opts.port]         — listen port; default MOJULO_APP_RUNTIME_PORT or 0.
 * @param {boolean} [opts.runReconcile] — run reconcile-on-boot (default true).
 * @param {string} [opts.appRoot]      — containment root; default MOJULO_APP_ROOT.
 * @param {boolean} [opts.allowReset]  — enable the /reset test seam (default from env).
 * @returns {Promise<{ server, port, bearer, close }>}
 */
export async function startDaemonServer(opts = {}) {
  ensureRuntimeDirs();
  const bearer = ensureBearer();
  const appRoot = opts.appRoot ?? process.env.MOJULO_APP_ROOT ?? null;
  const allowReset =
    opts.allowReset ?? process.env.MOJULO_APP_RUNTIME_ALLOW_RESET === '1';

  if (opts.runReconcile !== false) {
    try {
      await reconcile();
    } catch (err) {
      console.warn('[app-runtime] reconcile-on-boot failed:', err?.message || err);
    }
  }

  const requestedPort = opts.port ?? Number.parseInt(process.env.MOJULO_APP_RUNTIME_PORT || '0', 10);
  const server = http.createServer(buildHandler({ bearer, appRoot, allowReset }));

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(Number.isFinite(requestedPort) ? requestedPort : 0, '127.0.0.1', resolve);
  });

  const { port } = server.address();
  writePort(port);

  const close = () =>
    new Promise((resolve) => {
      server.close(() => resolve());
    });

  return { server, port, bearer, close };
}
