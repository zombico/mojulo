#!/usr/bin/env node
/**
 * `npm run smoke:tarball` — the cold-install gate, for both packages a release publishes.
 *
 * Packs core and the dashboard package (control/ui-package; or takes `--tarball <core.tgz>` and
 * `--ui-tarball <ui.tgz>`), installs both tarballs into an EMPTY temp directory the way
 * `npx mojulo-ui` does on a stranger's machine, and drives the result: core ships no dashboard
 * build, the dashboard package runs on that same core, `mojulo call version`, a diagram SVG
 * through the stdio loader, `initialize` + `tools/list` over stdio, `mojulo-ui` (core's shim, with
 * downloads refused) booting the dashboard on a free port, `/api/sketches`, a floorplan's SVG,
 * glb, scene, page and World, a streamed city's World page and one of its tiles, and a stash page
 * with an image upload. Then it reports the shipped sizes and every package that exists both
 * nested in the standalone bundle and hoisted in the fresh install at a DIFFERENT version.
 *
 * Why this exists: 2.0.5 shipped a dashboard that failed at module load on
 * every fresh install (nested sharp 0.34.5 JS + hoisted sharp 0.35.4 native
 * binaries) and never reproduced for the maintainer, whose npx caches predated
 * the drift. Verifying through the npx cache reuses an old tree; only an
 * install from the tarball into an empty directory sees what a user sees.
 *
 * Machine gate. Hard failures (install, version, a dead route, a shared package
 * still nested in the standalone bundle, a leftover .nft.json) exit 1. The
 * mismatch list for pure-JS packages is advisory and printed, never fatal.
 *
 *   node scripts/smoke-cold-install.mjs [--tarball <core.tgz>] [--ui-tarball <ui.tgz>] [--keep] [--with-recall]
 *
 * The default run is the DEFAULT install: no recall group, so `semantic_search`
 * must answer lexically. `--with-recall` runs `mojulo install recall` into the
 * temp home first (a ~480 MB runtime plus the ~130 MB model) and then expects
 * a vector result.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { UI_PACKAGE_BIN, UI_PACKAGE_NAME, UI_STANDALONE_DIR } from '../lib/version/ui-package.js';
import { BOT_FACTORY_MOVED, REMOVED_BOT_TOOLS } from '../lib/mcp/bot-factory-moved.js';
import { CONTROL_DIR, UI_PACKAGE_DIR, fromInstallPackages, matchesPackage } from './ui-package-manifest.mjs';
import { enginesViolations, floorOf } from './engines-floor.mjs';

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// The packages the dashboard resolves from the install it shares with core (native binaries and
// the server externals). None of these may exist nested in its standalone bundle.
const MUST_BE_HOISTED = fromInstallPackages();

// Installed only for the build, never for a user: the precompiled CreationMap twin
// replaces @swc/core, and three was only ever the creative pack's install marker.
const MUST_NOT_INSTALL = ['@swc/core', 'three'];

// The chatbot factory's document parsers (about 76 MB and 30 packages). They left with the
// factory in 3.0.0; neither package may come back into a default install.
const BOT_ONLY_PACKAGES = ['officeparser', 'pdf2json'];

// Dashboard-only packages, devDependencies since 2.2: the Next build compiles them
// into the standalone bundle (jsdom, which isomorphic-dompurify needs, is traced into
// the dashboard package's standalone/node_modules). The stash page and image upload below are the
// routes that use them.
const DASHBOARD_ONLY = ['isomorphic-dompurify', 'react-markdown', 'remark-gfm', 'swr', 'image-size'];

// A 1×1 PNG for the stash image upload (image-size reads its header).
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

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
  const args = { tarball: null, uiTarball: null, keep: false, recall: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tarball') args.tarball = path.resolve(argv[++i]);
    else if (a.startsWith('--tarball=')) args.tarball = path.resolve(a.slice('--tarball='.length));
    else if (a === '--ui-tarball') args.uiTarball = path.resolve(argv[++i]);
    else if (a.startsWith('--ui-tarball=')) args.uiTarball = path.resolve(a.slice('--ui-tarball='.length));
    else if (a === '--keep') args.keep = true;
    else if (a === '--with-recall' || a === '--with-embeddings') args.recall = true;
    else if (a === '-h' || a === '--help') {
      process.stdout.write(
        'Usage: node scripts/smoke-cold-install.mjs [--tarball <core.tgz>] [--ui-tarball <ui.tgz>] [--keep] [--with-recall]\n'
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

async function get(url, timeoutMs = 15000, init = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, redirect: 'manual' });
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

// Packs `dir` into control/ and returns the tarball path. Core's prepack writes the precompiled
// CreationMap twin; the dashboard package's prepack runs the Next build and stages it.
function pack(dir, what) {
  process.stderr.write(`smoke: npm pack ${what}\n`);
  const res = spawnSync(NPM, ['pack', '--json', '--pack-destination', CONTROL_DIR], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) throw new Error(`npm pack (${what}) exited ${res.status}`);
  // prepack's own stdout (Next's build banner, the staging scripts) lands in front of npm's
  // JSON under some npm versions: parse from the LAST line that opens an array and walk back.
  const lines = res.stdout.split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (!lines[i].startsWith('[')) continue;
    try {
      const [info] = JSON.parse(lines.slice(i).join('\n'));
      return path.join(CONTROL_DIR, info.filename);
    } catch { /* an earlier bracket line; keep walking back */ }
  }
  throw new Error(`npm pack --json printed no parseable array (stdout tail: ${JSON.stringify(res.stdout.slice(-200))})`);
}

// initialize, notifications/initialized and tools/list over the stdio server, as a host sends them.
function stdioToolsList(script, { cwd, env }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let buf = '';
    let stderr = '';
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill('SIGTERM');
      resolve({ ...result, stderr });
    };
    const timer = setTimeout(() => done({ error: 'no tools/list answer within 60 s' }), 60000);
    const send = (msg) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`);
    child.stderr.on('data', (d) => (stderr += d));
    child.on('exit', (code) => done({ error: `the stdio server exited ${code}` }));
    child.stdout.on('data', (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (msg.id === 1) {
          send({ method: 'notifications/initialized' });
          send({ id: 2, method: 'tools/list', params: {} });
        } else if (msg.id === 2) {
          done({ tools: msg.result?.tools ?? [], error: msg.error?.message });
        }
      }
    });
    send({
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'claude-code', version: 'smoke' } },
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const tarball = args.tarball ?? pack(CONTROL_DIR, 'core (prepack: the precompiled CreationMap twin)');
  const uiTarball = args.uiTarball ?? pack(UI_PACKAGE_DIR, `${UI_PACKAGE_NAME} (prepack: next build + stage)`);
  for (const t of [tarball, uiTarball]) if (!existsSync(t)) throw new Error(`tarball not found: ${t}`);
  const expectedVersion = pkgVersion(CONTROL_DIR);

  const tmp = mkdtempSync(path.join(os.tmpdir(), 'mojulo-smoke-'));
  const dataDir = path.join(tmp, 'mojulo-home');
  process.stderr.write(`smoke: core ${path.basename(tarball)} (${mb(statSync(tarball).size)})\n`);
  process.stderr.write(`smoke: dashboard ${path.basename(uiTarball)} (${mb(statSync(uiTarball).size)})\n`);
  process.stderr.write(`smoke: installing both into ${tmp}\n`);

  const env = {
    ...process.env,
    MOJULO_HOME: dataDir,
    MOJULO_DATA_DIR: path.join(dataDir, 'data'),
    MOJULO_OUTCOMES_DIR: path.join(dataDir, 'data', 'outcomes'),
    MOJULO_MODELS_DIR: path.join(dataDir, 'models'),
    // No MOJULO_SEMANTIC_INDEX_DISABLED: without the recall group the backfill
    // is text-only and fetches nothing, which is exactly what a cold install does.
    BROWSER: 'none',
    // Both packages are installed here; a shim that still reached for the registry is a failure.
    MOJULO_UI_NO_FETCH: '1',
  };

  let child = null;
  try {
    // ── install ──────────────────────────────────────────────────────────
    const t0 = Date.now();
    const init = spawnSync(NPM, ['init', '-y'], { cwd: tmp, stdio: 'ignore', shell: process.platform === 'win32' });
    if (init.status !== 0) throw new Error('npm init failed');
    const inst = spawnSync(NPM, ['install', tarball, uiTarball, '--no-audit', '--no-fund', '--loglevel=error'], {
      cwd: tmp,
      stdio: ['ignore', 'ignore', 'inherit'],
      shell: process.platform === 'win32',
    });
    if (inst.status !== 0) {
      fail(`npm install of the two tarballs exited ${inst.status}`);
      return;
    }
    ok(`npm install in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

    const nm = path.join(tmp, 'node_modules');
    const pkgDir = path.join(nm, 'mojulo');
    const uiDir = path.join(nm, UI_PACKAGE_NAME);
    const standaloneNm = path.join(uiDir, UI_STANDALONE_DIR, 'node_modules');
    note(`unpacked core ${mb(dirSize(pkgDir))}, dashboard ${mb(dirSize(uiDir))}, node_modules total ${mb(dirSize(nm))}`);

    // The embedding runtime is the opt-in recall group, not a dependency: a cold
    // install must not carry it.
    for (const name of ['@huggingface/transformers', 'onnxruntime-node', 'onnxruntime-web']) {
      if (existsSync(path.join(nm, name))) fail(`${name} was installed by the tarball — it belongs to the recall group`);
    }
    if (!existsSync(path.join(nm, '@huggingface'))) ok('no embedding runtime in the cold install (recall is opt-in)');

    const botPackages = BOT_ONLY_PACKAGES.filter((name) => existsSync(path.join(nm, name)));
    if (botPackages.length) fail(`${botPackages.join(' and ')} installed — the chatbot factory's document parsers left in 3.0.0`);
    else ok(`no ${BOT_ONLY_PACKAGES.join(' / ')} in the cold install (the chatbot factory left in 3.0.0)`);

    // A fresh install resolves every range anew, so an upstream release can raise a dependency's
    // engines.node above mojulo's floor (pdf2json 4.1.0 did). npm warns on each first start and
    // fails under engine-strict.
    const floor = floorOf(JSON.parse(readFileSync(path.join(CONTROL_DIR, 'package.json'), 'utf8')).engines.node);
    const engines = floor ? enginesViolations(nm, floor) : { checked: false, violations: [] };
    if (!engines.checked) note('engines check skipped: no semver or no node_modules/.package-lock.json');
    else if (engines.violations.length) {
      fail(`packages that refuse Node ${floor}, mojulo's floor: ${engines.violations.map((v) => `${v.name}@${v.version} (${v.range})`).join('; ')}`);
    } else ok(`every non-optional package accepts Node ${floor}, mojulo's floor`);

    // ── packaging invariants ─────────────────────────────────────────────
    // Core is what a host's `npx mojulo` downloads: no dashboard build, and no bot template (the
    // chatbot runtime left with the factory in 3.0.0).
    const coreCarries = ['.next', 'lite-template'].filter((d) => existsSync(path.join(pkgDir, d)));
    if (coreCarries.length) fail(`core ships ${coreCarries.join(' and ')} — .next belongs to ${UI_PACKAGE_NAME}, lite-template to no mojulo package`);
    else ok(`core ships no .next/ and no lite-template/ (the dashboard is ${UI_PACKAGE_NAME})`);

    // The dashboard runs on the core installed beside it, the local tarball at the same version.
    if (pkgVersion(uiDir) !== expectedVersion) fail(`${UI_PACKAGE_NAME} ${pkgVersion(uiDir)} ≠ core ${expectedVersion}`);
    if (existsSync(path.join(uiDir, 'node_modules', 'mojulo'))) {
      fail(`${UI_PACKAGE_NAME} got its own nested mojulo — the two packages would run different code on one database`);
    } else if (!existsSync(path.join(pkgDir, 'scripts', 'ui-launch.mjs'))) {
      fail('the installed core has no scripts/ui-launch.mjs — npm took mojulo from the registry, not the local tarball');
    } else ok(`${UI_PACKAGE_NAME} ${expectedVersion} shares the one core at node_modules/mojulo`);
    if (!existsSync(path.join(uiDir, UI_STANDALONE_DIR, 'server.js'))) fail(`${UI_PACKAGE_NAME} has no ${UI_STANDALONE_DIR}/server.js`);
    else if (existsSync(path.join(uiDir, 'lite-template'))) {
      fail(`${UI_PACKAGE_NAME} still ships lite-template/ — the chatbot runtime left with the factory in 3.0.0`);
    } else ok(`${UI_PACKAGE_NAME} ships ${UI_STANDALONE_DIR}/server.js and no lite-template/`);

    for (const name of listPackages(standaloneNm)) {
      if (matchesPackage(name, MUST_BE_HOISTED)) {
        fail(`${name} is nested in ${UI_STANDALONE_DIR}/node_modules — it must resolve from the install core shares`);
      }
    }
    // One copy for both processes: what the dashboard resolves by walking up from its build is
    // the copy core resolves, for every shared package the dashboard declares.
    const uiPkg = JSON.parse(readFileSync(path.join(uiDir, 'package.json'), 'utf8'));
    const shared = Object.keys({ ...uiPkg.dependencies, ...uiPkg.optionalDependencies })
      .filter((name) => matchesPackage(name, MUST_BE_HOISTED));
    const firstFrom = (dirs, name) => dirs.map((d) => path.join(d, 'node_modules', name)).find((p) => existsSync(p)) ?? null;
    const skewed = [];
    for (const name of shared) {
      const forUi = firstFrom([path.join(uiDir, UI_STANDALONE_DIR), uiDir, tmp], name);
      const forCore = firstFrom([pkgDir, tmp], name);
      if (forUi !== forCore) skewed.push(`${name} (dashboard ${forUi ?? 'none'}, core ${forCore ?? 'none'})`);
    }
    if (skewed.length) fail(`shared packages resolve to different copies: ${skewed.join('; ')}`);
    else ok(`the ${shared.length} shared packages resolve to one copy for core and the dashboard`);

    for (const name of MUST_NOT_INSTALL) {
      if (existsSync(path.join(nm, name))) fail(`${name} was installed by the tarball — it is build-only`);
    }
    const twin = path.join(pkgDir, 'components', 'graph', 'CreationMap.jsx.mjs');
    if (!existsSync(twin) || !readFileSync(twin, 'utf8').startsWith('// mojulo-precompiled source-sha256=')) {
      fail('components/graph/CreationMap.jsx.mjs (the prepack twin) is missing from the package');
    } else ok(`no ${MUST_NOT_INSTALL.join(' / ')} installed; the precompiled CreationMap twin ships`);
    const presentUiOnly = DASHBOARD_ONLY.filter((name) => existsSync(path.join(nm, name)));
    if (presentUiOnly.length) note(`dashboard-only packages present in the install (another dependency pulled them): ${presentUiOnly.join(', ')}`);

    const nft = findFiles(uiDir, (p) => p.endsWith('.nft.json'));
    if (nft.length) fail(`${nft.length} .nft.json trace manifests shipped in ${UI_PACKAGE_NAME}`);
    else ok('no .nft.json manifests');

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

    const uiHelp = spawnSync(process.execPath, [path.join(uiDir, uiPkg.bin[UI_PACKAGE_BIN]), '--help'], { cwd: tmp, env, encoding: 'utf8' });
    if (uiHelp.status !== 0 || !uiHelp.stdout.includes('Usage: mojulo-ui')) {
      fail(`${UI_PACKAGE_BIN} --help exited ${uiHelp.status}: ${(uiHelp.stderr || '').trim().split('\n').pop()}`);
    } else ok(`${UI_PACKAGE_BIN} --help answers (the dashboard package's bin, on core's launcher)`);

    // ── stdio, as a host drives it ───────────────────────────────────────
    const listed = await stdioToolsList(path.join(pkgDir, 'scripts', 'mcp-stdio.mjs'), { cwd: tmp, env });
    if (listed.error || !listed.tools?.length) {
      fail(`stdio initialize + tools/list failed: ${listed.error || 'no tools'}\n${(listed.stderr || '').slice(-800)}`);
    } else {
      ok(`stdio initialize + tools/list → ${listed.tools.length} tools (clientInfo claude-code)`);
      const removedListed = listed.tools.map((t) => t.name).filter((name) => REMOVED_BOT_TOOLS.includes(name));
      if (removedListed.length) fail(`tools/list still lists chatbot-factory tools: ${removedListed.join(', ')}`);
      else ok('tools/list lists no chatbot-factory tool');
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
    // `mojulo install chatbot` on 3.x installs nothing, says where the factory went, and exits 0.
    const chatbot = spawnSync(process.execPath, [stdio, 'install', 'chatbot'], { cwd: tmp, env, encoding: 'utf8' });
    if (chatbot.status !== 0 || !chatbot.stdout.includes(BOT_FACTORY_MOVED)) {
      fail(`mojulo install chatbot exited ${chatbot.status} without the moved notice: ${(chatbot.stdout || chatbot.stderr || '').trim().slice(0, 300)}`);
    } else ok('mojulo install chatbot prints where the chatbot factory went and exits 0');
    if (args.recall) {
      const t1 = Date.now();
      const inst = spawnSync(process.execPath, [stdio, 'install', 'recall'], { cwd: tmp, env, stdio: ['ignore', 'ignore', 'inherit'] });
      if (inst.status !== 0) fail(`mojulo install recall exited ${inst.status}`);
      else ok(`mojulo install recall in ${((Date.now() - t1) / 1000).toFixed(0)}s (${mb(dirSize(path.join(dataDir, 'recall')))})`);
    }

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

    // The stdio side renders diagrams through the same loader every bin registers; in a
    // published install it must serve the precompiled CreationMap (no @swc/core here).
    const svgProbe = spawnSync(process.execPath, ['--input-type=module', '-e', [
      "import { register } from 'node:module';",
      "import { pathToFileURL } from 'node:url';",
      `const pkg = ${JSON.stringify(pkgDir)};`,
      "register(pathToFileURL(pkg + '/scripts/mcp-stdio-loader.mjs'));",
      "const { renderSketchToSvg } = await import(pathToFileURL(pkg + '/lib/sketch-svg.js').href);",
      `process.stdout.write(await renderSketchToSvg(${JSON.stringify(DIAGRAM)}, { includeXmlDecl: false }));`,
    ].join('\n')], { cwd: tmp, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (svgProbe.status !== 0 || !/^<svg[\s>]/.test(svgProbe.stdout)) {
      fail(`diagram SVG through the stdio loader failed (exit ${svgProbe.status}): ${(svgProbe.stderr || '').trim().split('\n').pop()}`);
    } else ok(`diagram SVG through the stdio loader → ${svgProbe.stdout.length} bytes`);

    // semantic_search on a fresh process: the lexical index self-populates on the
    // first call (text-only reindex, no model), so this must return a routing card
    // with mode 'lexical' — or 'vector' when the recall group was installed above.
    const search = call('semantic_search', { query: 'build a little town I can walk around in', kinds: ['routing'], limit: 3 });
    let found = null;
    try {
      found = JSON.parse(search.stdout);
    } catch {}
    const wantMode = args.recall ? 'vector' : 'lexical';
    if (search.status !== 0 || !found) {
      fail(`semantic_search failed (exit ${search.status}): ${search.reason}`);
    } else if (found.mode !== wantMode || !Array.isArray(found.results) || found.results.length === 0) {
      fail(`semantic_search → mode ${found.mode}, ${found.results?.length ?? 0} results (wanted ${wantMode}, ≥1): ${JSON.stringify(found).slice(0, 300)}`);
    } else ok(`semantic_search → ${found.mode}, top ${found.results[0].source_ref} (${found.results[0].score.toFixed(2)})`);

    // ── dashboard, through core's `mojulo-ui` shim ───────────────────────
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
    if (/npm registry/.test(uiLog)) fail(`the mojulo-ui shim reached for the npm registry with ${UI_PACKAGE_NAME} installed:\n${uiLog.slice(-600)}`);
    else ok(`the mojulo-ui shim ran the installed ${UI_PACKAGE_NAME}, no download`);

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
      const world = await get(`${base}/api/sketches/${ref}/world`, 120000);
      if (world.status !== 200 || !/<html/i.test(world.body)) fail(`GET /api/sketches/${ref}/world → ${world.status}`);
      else ok(`GET /api/sketches/${ref}/world → 200, ${mb(world.bytes.length)}`);
    }

    // World streaming lives in the dashboard only: the ?stream=1 page and its tile route.
    const mintCity = call('compose_world', { base: 'city', seed: 2 });
    let cref = null;
    try {
      cref = JSON.parse(mintCity.stdout).ref;
    } catch {}
    if (mintCity.status !== 0 || !cref) {
      fail(`compose_world (city) failed (exit ${mintCity.status}): ${mintCity.reason}`);
    } else {
      ok(`compose_world city → ${cref}`);
      const streamed = await get(`${base}/api/sketches/${cref}/world?stream=1`, 180000);
      if (streamed.status !== 200 || !streamed.body.includes(`/api/sketches/${cref}/world/tile`)) {
        fail(`GET /api/sketches/${cref}/world?stream=1 → ${streamed.status}, no tile route in the page`);
      } else ok(`GET /api/sketches/${cref}/world?stream=1 → 200, the streamed page`);
      const tile = await get(`${base}/api/sketches/${cref}/world/tile?t=0,0&lod=massing`, 180000);
      if (tile.status !== 200 || tile.bytes.subarray(0, 4).toString('latin1') !== 'MJT1') {
        fail(`GET /api/sketches/${cref}/world/tile?t=0,0 → ${tile.status}, ${tile.bytes.length} bytes`);
      } else ok(`GET /api/sketches/${cref}/world/tile?t=0,0 → 200, ${tile.bytes.length} bytes`);
    }

    // The stash page server-renders the component that imports react-markdown,
    // remark-gfm and isomorphic-dompurify (→ jsdom); the image upload runs image-size.
    const mintStash = call('mint_stash', { title: 'smoke stash' });
    let sref = null;
    try {
      sref = JSON.parse(mintStash.stdout).stash_ref;
    } catch {}
    if (mintStash.status !== 0 || !sref) {
      fail(`mint_stash failed (exit ${mintStash.status}): ${mintStash.reason}`);
    } else {
      ok(`mint_stash → ${sref}`);
      const stashPage = await get(`${base}/stashes/${sref}`, 60000);
      if (stashPage.status !== 200) fail(`GET /stashes/${sref} → ${stashPage.status}`);
      else ok(`GET /stashes/${sref} → 200`);
      const form = new FormData();
      form.append('file', new Blob([PNG_1X1], { type: 'image/png' }), 'dot.png');
      const upload = await get(`${base}/api/stashes/${sref}/items`, 30000, { method: 'POST', body: form });
      let item = null;
      try {
        item = JSON.parse(upload.body).item;
      } catch {}
      if (upload.status !== 200 || item?.metadata?.width !== 1 || item?.metadata?.height !== 1) {
        fail(`POST /api/stashes/${sref}/items (image) → ${upload.status} ${upload.body.slice(0, 200)}`);
      } else ok(`POST /api/stashes/${sref}/items (image) → 200, 1×1 read by image-size`);
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
