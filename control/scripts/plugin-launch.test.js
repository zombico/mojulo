import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAUNCHER_DIR, launcherPackage } from './plugin-lock.mjs';

// The Claude plugin starts mojulo through plugins/mojulo/server/launch.mjs: npm ci from the lockfile beside it once,
// then the installed server. These run it against a folder already installed (no network, no npm), and without npm.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('the plugin launcher', () => {
  let root, server, home;
  const lock = JSON.stringify({ name: 'mojulo-claude-plugin-server', lockfileVersion: 3, packages: {} });
  const installDir = (version) => path.join(home, 'plugin', `${version}-${createHash('sha256').update(lock).digest('hex').slice(0, 12)}`);
  // a stand-in mojulo whose server prints what it was started with
  const installed = (version) => {
    const pkg = path.join(installDir(version), 'node_modules', 'mojulo');
    mkdirSync(path.join(pkg, 'scripts'), { recursive: true });
    writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: 'mojulo', version }));
    writeFileSync(path.join(pkg, 'scripts', 'mcp-stdio.mjs'), 'process.stdout.write(JSON.stringify({ args: process.argv.slice(2), dist: process.env.MOJULO_DISTRIBUTION }));\n');
  };
  const run = (env = {}) => spawnSync(process.execPath, [path.join(server, 'launch.mjs'), 'orient'], {
    env: { PATH: '', MOJULO_HOME: home, MOJULO_DISTRIBUTION: 'claude-plugin', ...env }, encoding: 'utf8',
  });

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'mojulo-launch-'));
    server = path.join(root, 'server');
    home = path.join(root, 'home');
    mkdirSync(server, { recursive: true });
    copyFileSync(path.join(REPO, LAUNCHER_DIR, 'launch.mjs'), path.join(server, 'launch.mjs'));
    writeFileSync(path.join(server, 'package.json'), JSON.stringify(launcherPackage('3.1.1')));
    writeFileSync(path.join(server, 'package-lock.json'), lock);
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('runs the installed server with its arguments and environment, stdout its own', () => {
    installed('3.1.1');
    const r = run();
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual({ args: ['orient'], dist: 'claude-plugin' });
  });

  it('says why on stderr, never stdout, when it cannot install or the folder holds another version', () => {
    let r = run();
    expect(r.status).toBe(1);
    expect(r.stdout).toBe('');
    expect(r.stderr).toMatch(/mojulo plugin: npm is not on the PATH/);
    expect(existsSync(installDir('3.1.1'))).toBe(false);
    // a folder named for this lockfile that holds another version is refused, not run
    installed('3.1.1');
    writeFileSync(path.join(installDir('3.1.1'), 'node_modules', 'mojulo', 'package.json'), JSON.stringify({ name: 'mojulo', version: '3.1.0' }));
    r = run();
    expect(r.status).toBe(1);
    expect(r.stdout).toBe('');
    expect(r.stderr).toMatch(/holds mojulo 3\.1\.0, expected 3\.1\.1/);
  });

  it('is the plugin\'s launcher package, small enough for the plugin directory to read', () => {
    const lockFile = path.join(REPO, LAUNCHER_DIR, 'package-lock.json');
    expect(readFileSync(lockFile).length).toBeLessThan(256 * 1024);
    expect(JSON.parse(readFileSync(path.join(REPO, LAUNCHER_DIR, 'package.json'), 'utf8')))
      .toEqual(launcherPackage(JSON.parse(readFileSync(path.join(REPO, 'control/package.json'), 'utf8')).version));
  });
});
