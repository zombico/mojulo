// `mojulo-ui` is core's shim for the dashboard, which ships as its own package since 3.0.0. The
// shim is driven here as it is installed: a copy of core's bin in a temp node_modules, with the
// dashboard package present, present at another version, or absent. Absent means a download from
// the npm registry, so the shim must say so before npm runs, and MOJULO_UI_NO_FETCH=1 must stop it.

import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UI_PACKAGE_BIN, UI_PACKAGE_NAME } from '../lib/version/ui-package.js';

const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = '9.9.9';
const SPEC = `${UI_PACKAGE_NAME}@${VERSION}`;

let tmp;
let core;

function writeFile(file, text) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function installFakeUi(version) {
  const root = path.join(tmp, 'node_modules', UI_PACKAGE_NAME);
  writeFile(path.join(root, 'package.json'), JSON.stringify({ name: UI_PACKAGE_NAME, version, bin: { [UI_PACKAGE_BIN]: 'bin/ui.mjs' } }));
  writeFile(
    path.join(root, 'bin', 'ui.mjs'),
    "import { writeFileSync } from 'node:fs';\nwriteFileSync(process.env.MARKER, JSON.stringify(process.argv.slice(2)));\n",
  );
}

function runShim(args, env = {}, cwd = tmp) {
  return spawnSync(process.execPath, [path.join(core, 'scripts', 'mcp-ui.mjs'), ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 20000,
    env: { ...process.env, MOJULO_UI_NO_FETCH: '', ...env },
  });
}

beforeEach(() => {
  tmp = mkdtempSync(path.join(tmpdir(), 'mojulo-ui-shim-'));
  core = path.join(tmp, 'node_modules', 'mojulo');
  writeFile(path.join(core, 'package.json'), JSON.stringify({ name: 'mojulo', version: VERSION, type: 'module' }));
  for (const rel of ['scripts/mcp-ui.mjs', 'scripts/ui-launch.mjs', 'scripts/mojulo-paths.mjs', 'lib/version/ui-package.js']) {
    mkdirSync(path.dirname(path.join(core, rel)), { recursive: true });
    copyFileSync(path.join(CONTROL_DIR, rel), path.join(core, rel));
  }
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('mojulo-ui shim', () => {
  it('runs the dashboard package installed beside core, with the same arguments', () => {
    installFakeUi(VERSION);
    const marker = path.join(tmp, 'ran.json');
    const res = runShim(['--no-open', '--port', '3999'], { MARKER: marker });
    expect(res.status, res.stderr).toBe(0);
    expect(JSON.parse(readFileSync(marker, 'utf8'))).toEqual(['--no-open', '--port', '3999']);
    expect(res.stderr).not.toMatch(/npm registry/);
  });

  it('downloads nothing under MOJULO_UI_NO_FETCH=1 and names the command that would', () => {
    const res = runShim(['--no-open'], { MOJULO_UI_NO_FETCH: '1' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`the dashboard is its own npm package, ${SPEC}`);
    expect(res.stderr).toContain('nothing was downloaded');
    expect(res.stderr).toContain(`npx -y ${SPEC}`);
  });

  it('will not run a dashboard package at another version', () => {
    installFakeUi('9.9.8');
    const res = runShim(['--no-open'], { MOJULO_UI_NO_FETCH: '1', MARKER: path.join(tmp, 'ran.json') });
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/at another version.*\(9\.9\.8\)/);
  });

  it.skipIf(process.platform === 'win32')('announces the registry download, then runs npm exec for this exact version', () => {
    const bin = path.join(tmp, 'bin');
    const log = path.join(tmp, 'npm-args.txt');
    writeFile(path.join(bin, 'npm'), `#!/bin/sh\nprintf '%s\\n' "$@" > "${log}"\n`);
    chmodSync(path.join(bin, 'npm'), 0o755);
    const res = runShim(['--port', '3999', '--no-open'], { PATH: `${bin}${path.delimiter}${process.env.PATH}` });
    expect(res.status, res.stderr).toBe(0);
    expect(res.stderr).toContain('downloading it from the npm registry into the npm cache');
    expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual([
      'exec', '--yes', `--package=${SPEC}`, '--', UI_PACKAGE_BIN, '--port', '3999', '--no-open',
    ]);
  });

  // `npx -y -p mojulo mojulo-ui` keeps the caller's working directory. A version-matched
  // mojulo-ui planted in that tree (a cloned repo, an unpacked archive) must not be imported.
  it('never runs a dashboard package found only from the working directory', () => {
    const proj = path.join(tmp, 'proj');
    const planted = path.join(proj, 'node_modules', UI_PACKAGE_NAME);
    const marker = path.join(tmp, 'planted-ran');
    writeFile(path.join(planted, 'package.json'), JSON.stringify({ name: UI_PACKAGE_NAME, version: VERSION, bin: 'x.mjs' }));
    writeFile(path.join(planted, 'x.mjs'), `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(marker)}, 'ran');\n`);
    const cwd = path.join(proj, 'deep', 'sub');
    mkdirSync(cwd, { recursive: true });
    const res = runShim(['--no-open'], { MOJULO_UI_NO_FETCH: '1' }, cwd);
    expect(existsSync(marker)).toBe(false);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('nothing was downloaded');
  });

  it('refuses an unknown argument before looking for anything', () => {
    const res = runShim(['--registry=http://example.test']);
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/unknown arg/);
  });
});
