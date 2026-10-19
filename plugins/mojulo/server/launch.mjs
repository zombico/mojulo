#!/usr/bin/env node
/**
 * The Claude plugin's MCP server launcher: installs mojulo from the lockfile beside this file, then runs it.
 *
 * package.json here depends on exactly one mojulo version, and package-lock.json pins that version and every
 * package under it: exact versions, registry.npmjs.org sources and integrity hashes, which `npm ci` checks on
 * install. Nothing is resolved at start, so the server that runs is the tree the lockfile names.
 *
 * The install lands once per lockfile in $MOJULO_HOME/plugin/<version>-<lock hash> (MOJULO_HOME defaults to
 * ~/.mojulo, where mojulo keeps its data). It is built in a temporary folder and renamed into place when `npm ci`
 * has finished, so a session that starts while another installs never runs a half-built tree. Later starts find
 * the folder and run at once.
 *
 * stdout is the MCP channel: npm writes to stderr, and so does every message here.
 *
 * Regenerate package.json and package-lock.json for a release with control/scripts/plugin-lock.mjs, after the
 * version is on npm.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const say = (line) => process.stderr.write(`mojulo plugin: ${line}\n`);

function nodeSupported(version = process.versions.node) {
  const [major, minor] = version.split('.').map(Number);
  return major > 22 || (major === 22 && minor >= 14);
}

// npm on the PATH, without a shell: npm.cmd on Windows (run through cmd, its only way to start), npm elsewhere
function findNpm(env = process.env) {
  const names = process.platform === 'win32' ? ['npm.cmd'] : ['npm'];
  for (const dir of (env.PATH || env.Path || '').split(path.delimiter).filter(Boolean)) {
    for (const name of names) {
      const file = path.join(dir, name);
      try { if (fs.statSync(file).isFile()) return file; } catch { /* not here */ }
    }
  }
  return null;
}

const alive = (pid) => {
  try { process.kill(pid, 0); return true; } catch (err) { return err.code === 'EPERM'; }
};

function install(dir, lock, npm) {
  const tmp = `${dir}.tmp-${process.pid}`;
  // a start cut short (Claude Code stops a server that takes over its start timeout) leaves its folder: clear the
  // ones whose process is gone; npm's cache keeps what they downloaded, so this install goes faster
  const parent = path.dirname(dir), stem = `${path.basename(dir)}.tmp-`;
  if (fs.existsSync(parent)) {
    for (const name of fs.readdirSync(parent)) {
      if (name.startsWith(stem) && !alive(Number(name.slice(stem.length)))) fs.rmSync(path.join(parent, name), { recursive: true, force: true });
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  fs.copyFileSync(path.join(HERE, 'package.json'), path.join(tmp, 'package.json'));
  fs.writeFileSync(path.join(tmp, 'package-lock.json'), lock);
  say(`installing mojulo from the plugin's lockfile into ${dir} (once per version; a minute or two)`);
  // npm lifecycle scripts stay on: better-sqlite3 fetches or builds its native binding there
  const args = ['ci', '--omit=dev', '--no-audit', '--no-fund', '--loglevel=error'];
  const win = process.platform === 'win32';
  const result = spawnSync(win ? `"${npm}"` : npm, args, { cwd: tmp, env: process.env, stdio: ['ignore', 2, 2], shell: win });
  if (result.error || result.status !== 0) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new Error(`npm ci failed (${result.error?.message || result.signal || `exit ${result.status}`}); the lockfile is ${path.join(HERE, 'package-lock.json')}`);
  }
  try {
    fs.renameSync(tmp, dir);
  } catch (err) {
    // another session finished the same install first: keep its folder, drop ours
    fs.rmSync(tmp, { recursive: true, force: true });
    if (!fs.existsSync(path.join(dir, 'node_modules', 'mojulo', 'package.json'))) throw err;
  }
}

function main() {
  if (!nodeSupported()) throw new Error(`mojulo needs Node 22.14 or newer; this is ${process.versions.node}`);
  const { dependencies } = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8'));
  const version = dependencies?.mojulo;
  if (!version) throw new Error('server/package.json names no mojulo version');
  const lock = fs.readFileSync(path.join(HERE, 'package-lock.json'));
  const home = process.env.MOJULO_HOME || path.join(os.homedir(), '.mojulo');
  const dir = path.join(home, 'plugin', `${version}-${createHash('sha256').update(lock).digest('hex').slice(0, 12)}`);
  const pkg = path.join(dir, 'node_modules', 'mojulo', 'package.json');
  if (!fs.existsSync(pkg)) {
    const npm = findNpm();
    if (!npm) throw new Error('npm is not on the PATH Claude Code sees; install Node.js 22.14 or newer (it brings npm)');
    install(dir, lock, npm);
  }
  const installed = JSON.parse(fs.readFileSync(pkg, 'utf8')).version;
  if (installed !== version) throw new Error(`${dir} holds mojulo ${installed}, expected ${version}; remove the folder and restart`);
  const child = spawn(process.execPath, [path.join(dir, 'node_modules', 'mojulo', 'scripts', 'mcp-stdio.mjs'), ...process.argv.slice(2)], {
    env: process.env, stdio: 'inherit',
  });
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => child.kill(signal));
  child.on('exit', (code, signal) => (signal ? process.kill(process.pid, signal) : process.exit(code ?? 1)));
}

try {
  main();
} catch (err) {
  say(err.message);
  process.exit(1);
}
