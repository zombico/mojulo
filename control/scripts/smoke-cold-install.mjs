#!/usr/bin/env node
/**
 * `npm run smoke:tarball` — the cold-install gate.
 *
 * Packs the control plane (or takes `--tarball <path>`), installs that tarball
 * into an EMPTY temp directory the way `npx mojulo` does on a stranger's
 * machine, and drives the result: `mojulo call version`, boot `mojulo-ui` on a
 * free port, read `/api/sketches`, mint a floorplan through the CLI and fetch
 * its SVG. Then it reports the shipped size and every package that exists both
 * nested in the standalone bundle and hoisted in the fresh install at a
 * DIFFERENT version.
 *
 * Why this exists: 2.0.5 shipped a dashboard that failed at module load on
 * every fresh install (nested sharp 0.34.5 JS + hoisted sharp 0.35.4 native
 * binaries) and never reproduced for the maintainer, whose npx caches predated
 * the drift. Verifying through the npx cache reuses an old tree; only an
 * install from the tarball into an empty directory sees what a user sees.
 *
 * Machine gate. Hard failures (install, version, a dead route, a native
 * partner still nested, a leftover .nft.json) exit 1. The mismatch list for
 * pure-JS packages is advisory and printed, never fatal.
 *
 *   node scripts/smoke-cold-install.mjs [--tarball <path>] [--keep] [--with-embeddings]
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// Every native package the `files` list strips from the standalone bundle, and
// the JS packages that hard-pair with them. None of these may exist nested:
// the hoisted install is the one place they come from.
const MUST_BE_HOISTED = [
  'better-sqlite3',
  '@img',
  'onnxruntime-node',
  'node-web-audio-api',
  'sharp',
  'onnxruntime-common',
  '@huggingface/transformers',
];

const FLOORPLAN = {
  kind: 'floorplan',
  title: 'smoke floorplan',
  width: 24,
  height: 28,
  rooms: [{ x: 2, y: 2, w: 20, h: 24, glyph: 'L' }],
  doors: [{ x: 12, y: 26, room: 0, edge: 'S' }],
  furnish: true,
  seed: 7,
};

// A diagram is what the SVG route is for; a world-kind recipe (the floorplan)
// has its still forms at /scene, /png and /model.glb instead.
const DIAGRAM = {
  title: 'smoke diagram',
  viewBox: { width: 640, height: 240 },
  stations: [
    { id: 'in', kind: 'input', label: 'recipe', x: 40, y: 80, w: 200, h: 80 },
    { id: 'out', kind: 'filesystem', label: 'render', x: 400, y: 80, w: 200, h: 80 },
  ],
  edges: [{ from: 'in', to: 'out', label: 'kernel' }],
};

function parseArgs(argv) {
  const args = { tarball: null, keep: false, embeddings: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tarball') args.tarball = path.resolve(argv[++i]);
    else if (a.startsWith('--tarball=')) args.tarball = path.resolve(a.slice('--tarball='.length));
    else if (a === '--keep') args.keep = true;
    else if (a === '--with-embeddings') args.embeddings = true;
    else if (a === '-h' || a === '--help') {
      process.stdout.write(
        'Usage: node scripts/smoke-cold-install.mjs [--tarball <path>] [--keep] [--with-embeddings]\n'
      );
      process.exit(0);
    } else {
      process.stderr.write(`smoke: unknown arg "${a}"\n`);
      process.exit(2);
    }
  }
  return args;
}

const failures = [];
const notes = [];
function fail(msg) {
  failures.push(msg);
  process.stderr.write(`  ✗ ${msg}\n`);
}
function ok(msg) {
  process.stderr.write(`  ✓ ${msg}\n`);
}
function note(msg) {
  notes.push(msg);
  process.stderr.write(`  · ${msg}\n`);
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

function dirSize(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) {
        try {
          total += statSync(p).size;
        } catch {}
      }
    }
  }
  return total;
}

function findFiles(dir, predicate, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) findFiles(p, predicate, out);
    else if (predicate(p)) out.push(p);
  }
  return out;
}

function pkgVersion(dir) {
  try {
    return JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')).version;
  } catch {
    return null;
  }
}

function listPackages(nmDir) {
  const names = [];
  let entries;
  try {
    entries = readdirSync(nmDir, { withFileTypes: true });
  } catch {
    return names;
  }
  for (const e of entries) {
    if (!e.isDirectory() || e.name === '.bin') continue;
    if (e.name.startsWith('@')) {
      for (const s of readdirSync(path.join(nmDir, e.name), { withFileTypes: true })) {
        if (s.isDirectory()) names.push(`${e.name}/${s.name}`);
      }
    } else names.push(e.name);
  }
  return names;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function get(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'manual' });
    const bytes = Buffer.from(await res.arrayBuffer());
    return { status: res.status, bytes, body: bytes.toString('utf8') };
  } catch (err) {
    return { status: 0, body: '', error: err.message };
  } finally {
    clearTimeout(t);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pack() {
  process.stderr.write('smoke: npm pack (runs prepack: stage + next build + stage-standalone)\n');
  const res = spawnSync(NPM, ['pack', '--json'], {
    cwd: CONTROL_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.status !== 0) throw new Error(`npm pack exited ${res.status}`);
  const [info] = JSON.parse(res.stdout);
  return path.join(CONTROL_DIR, info.filename);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const tarball = args.tarball ?? pack();
  if (!existsSync(tarball)) throw new Error(`tarball not found: ${tarball}`);
  const expectedVersion = pkgVersion(CONTROL_DIR);

  const tmp = mkdtempSync(path.join(os.tmpdir(), 'mojulo-smoke-'));
  const dataDir = path.join(tmp, 'mojulo-home');
  process.stderr.write(`smoke: tarball ${path.basename(tarball)} (${mb(statSync(tarball).size)})\n`);
  process.stderr.write(`smoke: installing into ${tmp}\n`);

  const env = {
    ...process.env,
    MOJULO_HOME: dataDir,
    MOJULO_DATA_DIR: path.join(dataDir, 'data'),
    MOJULO_OUTCOMES_DIR: path.join(dataDir, 'data', 'outcomes'),
    MOJULO_MODELS_DIR: path.join(dataDir, 'models'),
    // The backfill would fetch the ~130 MB embedding model on first getDb();
    // the sharp class of failure shows on /api/sketches without it.
    ...(args.embeddings ? {} : { MOJULO_SEMANTIC_INDEX_DISABLED: '1' }),
    BROWSER: 'none',
  };

  let child = null;
  try {
    // ── install ──────────────────────────────────────────────────────────
    const t0 = Date.now();
    const init = spawnSync(NPM, ['init', '-y'], { cwd: tmp, stdio: 'ignore' });
    if (init.status !== 0) throw new Error('npm init failed');
    const inst = spawnSync(NPM, ['install', tarball, '--no-audit', '--no-fund', '--loglevel=error'], {
      cwd: tmp,
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    if (inst.status !== 0) {
      fail(`npm install of the tarball exited ${inst.status}`);
      return;
    }
    ok(`npm install in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

    const nm = path.join(tmp, 'node_modules');
    const pkgDir = path.join(nm, 'mojulo');
    const standaloneNm = path.join(pkgDir, '.next', 'standalone', 'node_modules');
    note(`unpacked package ${mb(dirSize(pkgDir))}, node_modules total ${mb(dirSize(nm))}`);

    // ── packaging invariants ─────────────────────────────────────────────
    for (const name of MUST_BE_HOISTED) {
      if (existsSync(path.join(standaloneNm, name))) {
        fail(`${name} is still nested in .next/standalone/node_modules — add it to the files exclusions`);
      }
    }
    const nft = findFiles(path.join(pkgDir, '.next'), (p) => p.endsWith('.nft.json'));
    if (nft.length) fail(`${nft.length} .nft.json trace manifests shipped in the package`);
    else ok('no .nft.json manifests, native pairs all hoisted');

    const mismatches = [];
    for (const name of listPackages(standaloneNm)) {
      const nested = pkgVersion(path.join(standaloneNm, name));
      const hoisted = pkgVersion(path.join(nm, name));
      if (nested && hoisted && nested !== hoisted) mismatches.push(`${name} nested ${nested} / hoisted ${hoisted}`);
    }
    if (mismatches.length) {
      note(`${mismatches.length} pure-JS packages differ nested vs hoisted (advisory):`);
      for (const m of mismatches) process.stderr.write(`      ${m}\n`);
    }

    // ── CLI over the registry ────────────────────────────────────────────
    const stdio = path.join(pkgDir, 'scripts', 'mcp-stdio.mjs');
    const call = (tool, json) => {
      const r = spawnSync(process.execPath, [stdio, 'call', tool, '--json', JSON.stringify(json)], {
        cwd: tmp,
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 16 * 1024 * 1024,
      });
      // The CLI's own error line is `mojulo: …`; the telemetry line after it is noise.
      // The CLI's own error line is `mojulo: …` on stderr; a tool-level isError
      // prints its text on stdout. The telemetry line is noise either way.
      r.reason =
        (r.stderr || '').split('\n').filter((l) => l.startsWith('mojulo:')).pop() ||
        (r.stdout || '').trim().split('\n')[0] ||
        (r.stderr || '').trim().split('\n').pop();
      return r;
    };
    const ver = call('version', {});
    let reported = null;
    try {
      reported = JSON.parse(ver.stdout).server?.version;
    } catch {}
    if (ver.status !== 0 || !reported) {
      fail(`mojulo call version failed (exit ${ver.status}): ${ver.reason}`);
    } else if (reported !== expectedVersion) {
      fail(`installed version ${reported} ≠ package.json ${expectedVersion}`);
    } else ok(`mojulo call version → ${reported}`);

    // ── dashboard ────────────────────────────────────────────────────────
    const port = await findFreePort();
    const base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, [path.join(pkgDir, 'scripts', 'mcp-ui.mjs'), '--port', String(port), '--no-open'], {
      cwd: tmp,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let uiLog = '';
    child.stdout.on('data', (d) => (uiLog += d));
    child.stderr.on('data', (d) => (uiLog += d));

    let up = false;
    for (let i = 0; i < 60 && !up; i++) {
      await sleep(1000);
      if (child.exitCode !== null) break;
      up = (await get(`${base}/`, 3000)).status === 200;
    }
    if (!up) {
      fail(`mojulo-ui never answered on ${base}\n${uiLog.slice(-1500)}`);
      return;
    }
    ok(`mojulo-ui up on ${base}`);

    const list = await get(`${base}/api/sketches`);
    if (list.status !== 200) fail(`GET /api/sketches → ${list.status} ${list.error || ''}`);
    else ok('GET /api/sketches → 200');

    const mintDiagram = call('create_sketch', { title: DIAGRAM.title, manifest: DIAGRAM });
    let dref = null;
    try {
      dref = JSON.parse(mintDiagram.stdout).ref;
    } catch {}
    if (mintDiagram.status !== 0 || !dref) {
      fail(`create_sketch (diagram) failed (exit ${mintDiagram.status}): ${mintDiagram.reason}`);
    } else {
      ok(`create_sketch diagram → ${dref}`);
      const svg = await get(`${base}/api/sketches/${dref}/svg`, 60000);
      if (svg.status !== 200 || !/<svg[\s>]/i.test(svg.body)) {
        fail(`GET /api/sketches/${dref}/svg → ${svg.status}, body starts: ${JSON.stringify(svg.body.slice(0, 120))}`);
      } else ok(`GET /api/sketches/${dref}/svg → 200, ${svg.bytes.length} bytes`);
    }

    const mint = call('create_sketch', { title: FLOORPLAN.title, manifest: FLOORPLAN });
    let ref = null;
    try {
      ref = JSON.parse(mint.stdout).ref;
    } catch {}
    if (mint.status !== 0 || !ref) {
      fail(`create_sketch (floorplan) failed (exit ${mint.status}): ${mint.reason}`);
    } else {
      ok(`create_sketch floorplan → ${ref}`);
      // The polygonizer, with no browser: a binary glTF starts with the magic 'glTF'.
      const glb = await get(`${base}/api/sketches/${ref}/model.glb`, 120000);
      if (glb.status !== 200 || glb.bytes.subarray(0, 4).toString('latin1') !== 'glTF') {
        fail(`GET /api/sketches/${ref}/model.glb → ${glb.status}, ${glb.bytes.length} bytes`);
      } else ok(`GET /api/sketches/${ref}/model.glb → 200, ${mb(glb.bytes.length)}`);
      const scene = await get(`${base}/api/sketches/${ref}/scene`, 120000);
      if (scene.status !== 200 || !/<html|<div/i.test(scene.body)) fail(`GET /api/sketches/${ref}/scene → ${scene.status}`);
      else ok(`GET /api/sketches/${ref}/scene → 200, ${mb(scene.bytes.length)}`);
      const page = await get(`${base}/sketches/${ref}`, 60000);
      if (page.status !== 200) fail(`GET /sketches/${ref} → ${page.status}`);
      else ok(`GET /sketches/${ref} → 200`);
    }

    const errs = uiLog.split('\n').filter((l) => /⨯|TypeError|Error:/.test(l));
    if (errs.length) {
      fail(`${errs.length} error line(s) in the dashboard log:\n${errs.slice(0, 6).map((l) => '      ' + l).join('\n')}`);
    } else ok('dashboard log clean');
  } finally {
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await sleep(1500);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    if (args.keep) process.stderr.write(`smoke: kept ${tmp}\n`);
    else rmSync(tmp, { recursive: true, force: true });
  }
}

main()
  .then(() => {
    process.stderr.write('\n');
    if (failures.length) {
      process.stderr.write(`smoke: FAILED — ${failures.length} hard failure(s)\n`);
      process.exit(1);
    }
    process.stderr.write('smoke: PASSED (machine gate; nobody has looked at a render)\n');
  })
  .catch((err) => {
    process.stderr.write(`smoke: ${err.message}\n`);
    process.exit(1);
  });
