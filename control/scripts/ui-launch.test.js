import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findUiPackage, parseUiArgs, uiArgsToArgv } from './ui-launch.mjs';
import { prunedPackages } from './ui-package-manifest.mjs';
import { UI_PACKAGE_BIN, UI_PACKAGE_NAME } from '../lib/version/ui-package.js';

const SRC = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'ui-launch.mjs'), 'utf8');

let tmp;
beforeEach(() => {
  // Real path: Node resolves packages through symlinks, and macOS's tmpdir is one (/var → /private/var).
  tmp = realpathSync(mkdtempSync(path.join(tmpdir(), 'mojulo-ui-launch-')));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function writePackage(dir, pkg) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
}

describe('dashboard bind host', () => {
  // The launcher boots the standalone server at call time, so this stays a source-level pin:
  // `process.env.HOSTNAME ??=` let a Linux shell's exported HOSTNAME=<machine> become the bind
  // address, and 127.0.0.1 refused (grok-headless-affordances P2).
  it('sets HOSTNAME unconditionally (never a ??= default) with MOJULO_UI_HOST as the override', () => {
    expect(SRC).not.toMatch(/process\.env\.HOSTNAME\s*\?\?=/);
    expect(SRC).toMatch(/process\.env\.HOSTNAME\s*=\s*host;/);
    expect(SRC).toMatch(/process\.env\.MOJULO_UI_HOST\s*\|\|\s*'127\.0\.0\.1'/);
  });
});

describe('parseUiArgs', () => {
  it('reads the port and --no-open, and round-trips them for another process', () => {
    const args = parseUiArgs(['--port', '3999', '--no-open']);
    expect(args).toEqual({ port: 3999, open: false, help: false });
    expect(uiArgsToArgv(args)).toEqual(['--port', '3999', '--no-open']);
    expect(parseUiArgs(['--port=4000']).port).toBe(4000);
    expect(uiArgsToArgv(parseUiArgs([]))).toEqual([]);
  });

  it('refuses anything else, so only known flags are ever forwarded to npm exec', () => {
    expect(parseUiArgs(['--port', '3999; rm -rf ~']).error).toMatch(/invalid --port/);
    expect(parseUiArgs(['--port', '70000']).error).toMatch(/invalid --port/);
    expect(parseUiArgs(['--port']).error).toMatch(/invalid --port/);
    expect(parseUiArgs(['--registry=http://example.test']).error).toMatch(/unknown arg/);
  });
});

describe('findUiPackage', () => {
  const core = () => path.join(tmp, 'node_modules', 'mojulo');
  const ui = () => path.join(tmp, 'node_modules', UI_PACKAGE_NAME);

  it('finds the dashboard package beside core at the same version', () => {
    writePackage(core(), { name: 'mojulo', version: '9.9.9' });
    writePackage(ui(), { name: UI_PACKAGE_NAME, version: '9.9.9', bin: { [UI_PACKAGE_BIN]: 'bin/x.mjs' } });
    expect(findUiPackage({ version: '9.9.9', from: [core()] })).toEqual({
      root: ui(),
      bin: path.join(ui(), 'bin', 'x.mjs'),
    });
  });

  it('refuses one at another version and reports where it was', () => {
    writePackage(core(), { name: 'mojulo', version: '9.9.9' });
    writePackage(ui(), { name: UI_PACKAGE_NAME, version: '9.9.8', bin: { [UI_PACKAGE_BIN]: 'bin/x.mjs' } });
    expect(findUiPackage({ version: '9.9.9', from: [core()] })).toEqual({
      root: null,
      mismatched: [{ root: ui(), version: '9.9.8' }],
    });
  });

  it('returns nothing when it is not installed', () => {
    writePackage(core(), { name: 'mojulo', version: '9.9.9' });
    expect(findUiPackage({ version: '9.9.9', from: [core()] })).toEqual({ root: null, mismatched: [] });
  });
});

describe('prunedPackages', () => {
  it('drops the shared packages and what only they pulled in, and keeps what another package needs', () => {
    const nm = path.join(tmp, 'node_modules');
    writePackage(path.join(nm, 'next'), { dependencies: { 'styled-jsx': '*' }, optionalDependencies: { sharp: '*' } });
    writePackage(path.join(nm, 'styled-jsx'), {});
    writePackage(path.join(nm, 'sharp'), { dependencies: { 'detect-libc': '*' } });
    writePackage(path.join(nm, 'detect-libc'), {});
    writePackage(path.join(nm, '@img', 'sharp-libvips'), {});
    writePackage(path.join(nm, 'puppeteer-core'), { dependencies: { ws: '*', debug: '*' } });
    writePackage(path.join(nm, 'debug'), {});
    writePackage(path.join(nm, 'jsdom'), { dependencies: { ws: '*' } });
    writePackage(path.join(nm, 'ws'), {});
    expect(prunedPackages(nm, ['sharp', '@img', 'puppeteer-core'])).toEqual([
      '@img/sharp-libvips',
      'debug',
      'detect-libc',
      'puppeteer-core',
      'sharp',
    ]);
  });
});
