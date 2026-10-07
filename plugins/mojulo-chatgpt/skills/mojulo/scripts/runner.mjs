#!/usr/bin/env node
// ChatGPT Work-box runner. No dependencies; status never initializes the database.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const DEFAULT_VERSION = '3.1.0';
const USAGE = `runner.mjs status|install|exec|checkpoint|restore --workspace <absolute-dir>
  [--version <exact-version>] [--package-root <existing-mojulo-package>]
  install: [--tarball <local.tgz>] (otherwise installs mojulo@<version> from npm)
  exec: -- orient|help|tools|packs|call <tool> [arguments]
  checkpoint: --recipe <recipe.json> --ref <ref> --title <title> --out <new.json>
  restore: --capsule <checkpoint.json> (uses create_sketch; existing refs are not replaced)
  [--timeout-ms <milliseconds>] (default 180000; install uses at least 600000)
The workspace contains .mojulo-chatgpt/runtime and .mojulo-chatgpt/home.
Use connected MCP instead when it is available. This runner cannot create a Work box.`;

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!['status', 'install', 'exec', 'checkpoint', 'restore'].includes(command)) throw new Error(USAGE);
  const opts = { command, version: DEFAULT_VERSION, timeoutMs: 180000, args: [] };
  const fields = { '--workspace': 'workspace', '--version': 'version', '--package-root': 'packageRoot', '--tarball': 'tarball', '--recipe': 'recipe', '--ref': 'ref', '--title': 'title', '--out': 'out', '--timeout-ms': 'timeoutMs', '--capsule': 'capsule' };
  const seen = new Set();
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--') { opts.args = rest.slice(i + 1); break; }
    const key = fields[rest[i]];
    if (!key || seen.has(key) || !rest[i + 1] || rest[i + 1].startsWith('--')) throw new Error(`Invalid option: ${rest[i]}\n${USAGE}`);
    seen.add(key);
    opts[key] = rest[++i];
  }
  if (!opts.workspace || !path.isAbsolute(opts.workspace)) throw new Error('--workspace must be an absolute path');
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(opts.version) || Number(opts.version.split('.')[0]) < 3) throw new Error('--version must pin an exact Mojulo version >=3.0.0; tags and ranges are not accepted');
  opts.timeoutMs = Number(opts.timeoutMs);
  if (!Number.isSafeInteger(opts.timeoutMs) || opts.timeoutMs <= 0) throw new Error('--timeout-ms must be a positive integer');
  if (command === 'exec' && !['orient', 'help', 'tools', 'packs', 'call'].includes(opts.args[0])) throw new Error('exec requires -- followed by orient, help, tools, packs or call');
  if (command !== 'exec' && opts.args.length) throw new Error('Only exec accepts arguments after --');
  if (opts.tarball && command !== 'install') throw new Error('--tarball is only for install');
  if (command === 'install' && opts.packageRoot) throw new Error('install cannot modify an existing --package-root; choose a new workspace');
  if (command !== 'checkpoint' && ['recipe', 'ref', 'title', 'out'].some((k) => opts[k])) throw new Error('Recipe options are only for checkpoint');
  if (command === 'checkpoint' && (!opts.recipe || !opts.out || !opts.title || !/^[A-Za-z0-9_-]{1,64}$/.test(opts.ref || ''))) throw new Error('checkpoint requires --recipe, --out, --title and a valid --ref');
  if (command === 'restore' && !opts.capsule) throw new Error('restore requires --capsule');
  if (command !== 'restore' && opts.capsule) throw new Error('--capsule is only for restore');
  return opts;
}

export function locations(opts) {
  const root = path.join(opts.workspace, '.mojulo-chatgpt');
  const runtime = path.join(root, 'runtime');
  return { root, runtime, home: path.join(root, 'home'), packageRoot: path.resolve(opts.packageRoot || path.join(runtime, 'node_modules', 'mojulo')), receipt: path.join(runtime, 'install.json') };
}

function readJson(filename) { return JSON.parse(fs.readFileSync(filename, 'utf8')); }
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function nodeSupported(version = process.versions.node) {
  const [major, minor] = version.split('.').map(Number);
  return major > 22 || (major === 22 && minor >= 14);
}
function executable(filename) {
  try { return fs.statSync(filename).isFile() && (fs.accessSync(filename, fs.constants.X_OK), true); } catch { return false; }
}
function findExecutable(names, env) {
  for (const name of names.filter(Boolean)) {
    if (path.isAbsolute(name)) { if (executable(name)) return name; }
    else for (const dir of (env.PATH || '').split(path.delimiter).filter(Boolean)) {
      const file = path.join(dir, name);
      if (executable(file)) return file;
    }
  }
  return null;
}

export function status(opts, env = process.env) {
  const loc = locations(opts);
  const pkgFile = path.join(loc.packageRoot, 'package.json');
  let installed = null;
  if (fs.existsSync(pkgFile)) {
    const pkg = readJson(pkgFile);
    installed = { name: pkg.name, version: pkg.version };
  }
  const entry = path.join(loc.packageRoot, 'scripts', 'mcp-stdio.mjs');
  return {
    ok: nodeSupported() && installed?.name === 'mojulo' && installed?.version === opts.version && fs.existsSync(entry),
    node: process.versions.node, nodeSupported: nodeSupported(), requestedVersion: opts.version,
    installed, ...loc, entry,
    npm: findExecutable(['npm'], env),
    chromium: findExecutable([env.MOJULO_CHROMIUM, env.PUPPETEER_EXECUTABLE_PATH, 'chromium', 'chromium-browser', 'google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'], env),
    ffmpeg: findExecutable([env.MOJULO_FFMPEG, 'ffmpeg'], env),
    delivery: 'Use the current session’s file tools; no attachment path or inline viewer is assumed.',
  };
}

// Override inherited storage variables too: MOJULO_HOME alone does not isolate Mojulo.
export function runnerEnv(opts, env = process.env) {
  const loc = locations(opts);
  const data = path.join(loc.home, 'data');
  return {
    ...env, MOJULO_HOST: 'chatgpt', MOJULO_SURFACE: 'box', MOJULO_DISTRIBUTION: 'npm',
    MOJULO_CONTROL_DIR: loc.packageRoot, MOJULO_HOME: loc.home, MOJULO_DATA_DIR: data,
    SQLITE_PATH: path.join(data, 'mojulo-lite.db'), STORAGE_ROOT: path.join(data, 'storage'),
    MOJULO_MODELS_DIR: path.join(loc.home, 'models'), MOJULO_CHROMIUM_DIR: path.join(loc.home, 'chromium'), MOJULO_FFMPEG_DIR: path.join(loc.home, 'ffmpeg'),
    MOJULO_OUTCOMES_DIR: path.join(data, 'outcomes'), MOJULO_EXPORTS_DIR: path.join(data, 'exports'),
    MOJULO_SCENE_PNG_DIR: path.join(data, 'scene-png'), MOJULO_TURNTABLE_DIR: path.join(data, 'turntable'), MOJULO_FIGURE_SPECS_DIR: path.join(data, 'figure-specs'),
  };
}
function requireReady(opts) {
  const report = status(opts);
  if (!report.ok) throw new Error(`Mojulo runtime is not ready: ${JSON.stringify(report)}. Run status; use install for a fresh runtime or point --package-root at the matching version.`);
  return report;
}

export function install(opts, spawn = spawnSync) {
  if (!nodeSupported()) throw new Error('Mojulo requires Node >=22.14');
  const loc = locations(opts);
  const source = opts.tarball ? path.resolve(opts.tarball) : `mojulo@${opts.version}`;
  const provenance = opts.tarball
    ? { kind: 'tarball', file: path.basename(source), sha256: sha256(fs.readFileSync(source)) }
    : { kind: 'npm', spec: source };
  const current = status(opts);
  if (current.installed) {
    const receipt = fs.existsSync(loc.receipt) ? readJson(loc.receipt) : null;
    if (current.ok && JSON.stringify(receipt?.source) === JSON.stringify(provenance)) return { ...current, reused: true, source: provenance };
    throw new Error('This workspace already has a different or unrecorded runtime. Reuse it with --package-root or choose a fresh workspace; install does not replace it.');
  }
  if (!current.npm) throw new Error('npm is unavailable; install Node/npm or reuse an existing package');
  fs.mkdirSync(loc.runtime, { recursive: true });
  // No shell interpolation. npm lifecycle scripts are required for native dependencies.
  const result = spawn(current.npm, ['install', '--prefix', loc.runtime, '--save-exact', '--omit=dev', '--no-audit', '--no-fund', '--', source], {
    cwd: opts.workspace, env: process.env, stdio: ['ignore', 2, 2], timeout: Math.max(600000, opts.timeoutMs),
  });
  if (result.error || result.status !== 0) throw new Error(`npm install failed: ${result.error?.message || result.signal || result.status}`);
  const ready = requireReady(opts);
  fs.writeFileSync(loc.receipt, JSON.stringify({ version: opts.version, source: provenance }, null, 2) + '\n');
  return { ...ready, reused: false, source: provenance };
}

export function checkpoint(opts) {
  const report = requireReady(opts);
  const manifest = readJson(path.resolve(opts.recipe));
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('recipe must contain a manifest object');
  const receipt = !opts.packageRoot && fs.existsSync(report.receipt) ? readJson(report.receipt) : null;
  const capsule = {
    format: 'mojulo-chatgpt-recipe-v1',
    mojulo: { version: report.installed.version, source: receipt?.source || { kind: 'existing-package', note: 'Package version verified; retain the exact development build separately when unreleased.' } },
    manifestSha256: sha256(JSON.stringify(manifest)),
    restore: { title: opts.title, ref: opts.ref, manifest },
    dependencies: { bundled: false, note: 'External assets, referenced recipes and custom recipe books must be preserved separately. create_sketch revalidates and may normalize the manifest; compare the restored export.' },
  };
  fs.writeFileSync(path.resolve(opts.out), JSON.stringify(capsule, null, 2) + '\n', { flag: 'wx' });
  return { ok: true, path: path.resolve(opts.out), version: capsule.mojulo.version, manifestSha256: capsule.manifestSha256 };
}

export function readCapsule(opts) {
  const capsule = readJson(path.resolve(opts.capsule));
  if (capsule.format !== 'mojulo-chatgpt-recipe-v1' || !capsule.restore?.manifest || !capsule.restore.title || !/^[A-Za-z0-9_-]{1,64}$/.test(capsule.restore.ref || '')) throw new Error('Invalid Mojulo recipe capsule');
  if (capsule.mojulo?.version !== opts.version) throw new Error(`Capsule needs Mojulo ${capsule.mojulo?.version}; rerun with that exact --version and runtime`);
  if (sha256(JSON.stringify(capsule.restore.manifest)) !== capsule.manifestSha256) throw new Error('Capsule manifest hash mismatch; inspect the edited recipe before making a new checkpoint');
  if (capsule.mojulo.source?.kind === 'tarball') {
    const loc = locations(opts);
    const receipt = !opts.packageRoot && fs.existsSync(loc.receipt) ? readJson(loc.receipt) : null;
    if (receipt?.source?.sha256 !== capsule.mojulo.source.sha256) throw new Error('Capsule needs the original development tarball; install that tarball into a fresh workspace first');
  }
  // Ignore unrelated fields: this is a create_sketch input, never executable CLI arguments.
  const { title, ref, manifest } = capsule.restore;
  return { title, ref, manifest };
}

export function run(opts) {
  if (opts.command === 'status') return status(opts);
  if (opts.command === 'install') return install(opts);
  if (opts.command === 'checkpoint') return checkpoint(opts);
  const report = requireReady(opts);
  const restore = opts.command === 'restore' ? readCapsule(opts) : null;
  // Mojulo chdirs into its package before resolving @files; anchor those to the workspace.
  const args = restore ? ['call', 'create_sketch', '--json', '-'] : opts.args.map((arg, i, all) =>
    all[i - 1] === '--json' && arg.startsWith('@') ? '@' + path.resolve(opts.workspace, arg.slice(1)) : arg);
  const result = spawnSync(process.execPath, [report.entry, ...args], {
    cwd: opts.workspace, env: runnerEnv(opts), stdio: restore ? ['pipe', 'inherit', 'inherit'] : 'inherit',
    ...(restore ? { input: JSON.stringify(restore) } : {}), timeout: opts.timeoutMs,
  });
  if (result.error) throw new Error(`Mojulo execution failed: ${result.error.message}`);
  process.exitCode = result.status ?? 1;
  return null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = run(parseArgs(process.argv.slice(2)));
    if (result) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
