import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it, expect, afterAll } from 'vitest';
import { ELECTRON_TARGET, desktopAppName, desktopMainJs, desktopPackageJson } from './desktop-shell.js';

// An `electron` module that records what main.js asks of it, so the emitted script runs under plain Node.
const STUB = `const calls = { on: {} };
globalThis.__electron = calls;
module.exports = {
  app: { setPath: (k, v) => { calls.userData = v; }, getPath: () => '/appdata', whenReady: () => Promise.resolve(), on: () => {}, exit: (c) => { calls.exit = c; } },
  protocol: { registerSchemesAsPrivileged: (s) => { calls.schemes = s; }, handle: (name, fn) => { calls.scheme = name; calls.handler = fn; } },
  net: { fetch: (url) => ({ fetched: url }) },
  session: { defaultSession: { webRequest: { onBeforeRequest: (filter, fn) => { calls.block = { filter, fn }; } } } },
  shell: { openExternal: (url) => { calls.external = url; } },
  BrowserWindow: class { constructor(opts) { calls.win = opts; this.webContents = { setWindowOpenHandler: (fn) => { calls.open = fn; }, on: (e, fn) => { calls.on[e] = fn; } }; } loadURL(url) { calls.loaded = url; } },
};`;

const dirs = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

function appFolder(app) {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), 'desktop-shell-')));
  dirs.push(dir);
  mkdirSync(path.join(dir, 'node_modules', 'electron'), { recursive: true });
  writeFileSync(path.join(dir, 'node_modules', 'electron', 'index.js'), STUB);
  writeFileSync(path.join(dir, 'main.js'), desktopMainJs(app));
  mkdirSync(path.join(dir, 'levels'));
  writeFileSync(path.join(dir, 'game.html'), '<!doctype html>');
  writeFileSync(path.join(dir, 'levels', 'a.html'), '<!doctype html>');
  return dir;
}

describe('desktop-shell', () => {
  it('the package and main script are pure functions of the title and ref', () => {
    const app = { title: 'Kart "Cup" 64', ref: 'sk_Kart_1' };
    expect(desktopPackageJson(app)).toBe(desktopPackageJson({ ...app }));
    expect(desktopMainJs(app)).toBe(desktopMainJs({ ...app }));
    expect(desktopAppName(app)).toBe('kart-cup-64-sk-kart-1');
    expect(desktopAppName({ title: '???', ref: 'sk_x' })).toBe('mojulo-game-sk-x');
    const pkg = JSON.parse(desktopPackageJson(app));
    expect(pkg.productName).toBe('Kart "Cup" 64');
    expect(pkg.devDependencies).toEqual({ electron: ELECTRON_TARGET });
    expect(pkg.scripts.package).toMatch(/@electron\/packager \. --out=dist/);
  });

  it('main.js parses as a script', () => {
    const dir = appFolder({ title: 'Check', ref: 'sk_check' });
    const r = spawnSync(process.execPath, ['--check', path.join(dir, 'main.js')], { encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
  });

  it('main.js serves only this folder over game://, blocks the network and sends outside links to the browser', async () => {
    const dir = appFolder({ title: 'Serve', ref: 'sk_serve' });
    const argv = process.argv;
    process.argv = [process.execPath, dir];
    try {
      createRequire(path.join(dir, 'x.js'))('./main.js');
    } finally {
      process.argv = argv;
    }
    await new Promise((r) => setTimeout(r, 0));
    const calls = globalThis.__electron;
    expect(calls.userData).toBe(path.join('/appdata', 'serve-sk-serve'));
    expect(calls.schemes[0]).toMatchObject({ scheme: 'game', privileges: { standard: true, secure: true, supportFetchAPI: true } });
    expect(calls.scheme).toBe('game');
    expect(calls.loaded).toBe('game://app/game.html');
    expect(calls.win.show).toBe(true);

    expect(calls.handler({ url: 'game://app/levels/a.html' })).toEqual({ fetched: pathToFileURL(path.join(dir, 'levels', 'a.html')).toString() });
    for (const url of ['game://app/%2e%2e/%2e%2e/etc/passwd', 'game://app/..%2F..%2Fsecret', 'game://app/levels/none.html', 'game://app/levels']) {
      expect(calls.handler({ url }).status, url).toBe(404);
    }
    expect(calls.block.filter.urls).toEqual(expect.arrayContaining(['http://*/*', 'https://*/*']));
    let cancelled;
    calls.block.fn({}, (r) => { cancelled = r.cancel; });
    expect(cancelled).toBe(true);

    expect(calls.open({ url: 'https://example.com/credits' })).toEqual({ action: 'deny' });
    expect(calls.external).toBe('https://example.com/credits');
    let prevented = false;
    calls.on['will-navigate']({ preventDefault: () => { prevented = true; } }, 'file:///etc/hosts');
    expect(prevented).toBe(true);
  });
});

describe('desktop-gate', () => {
  it('loads the shell and the first real level, and reads the report line', async () => {
    const { smokePages, parseSmoke, runDesktopGate } = await import('./desktop-gate.js');
    expect(smokePages([{ file: 'README.md' }, { file: 'levels/menu-x.html' }, { file: 'levels/preview-y.html' }, { file: 'levels/sk_a.html' }]))
      .toEqual(['game.html', 'levels/sk_a.html']);
    expect(smokePages(['game.html', 'recipe/game.json'])).toEqual(['game.html']);
    expect(parseSmoke('noise\nMOJULO_SMOKE {"ok":true,"pages":[]}\n')).toEqual({ ok: true, pages: [] });
    expect(parseSmoke('no line')).toBe(null);
    expect(await runDesktopGate({ dir: '/x', electron: null, pages: [] })).toMatchObject({ ran: false, skipped: expect.stringMatching(/MOJULO_ELECTRON/) });
  });

  it('lays `env` over the environment for the app it launches (a stand-in Electron that prints the report)', async () => {
    if (process.platform === 'win32') return;
    const { runDesktopGate } = await import('./desktop-gate.js');
    // `node -e` as the binary: argv is [dir, --mojulo-smoke, ...pages]; it echoes the bound back as the report
    const d = mkdtempSync(path.join(tmpdir(), 'desk-gate-'));
    const bin = path.join(d, 'electron');
    writeFileSync(bin, `#!${process.execPath}\nprocess.stdout.write('MOJULO_SMOKE ' + JSON.stringify({ ok: true, t: process.env.MOJULO_SMOKE_TIMEOUT_MS, pages: process.argv.slice(4) }) + '\\n');\n`, { mode: 0o755 });
    const fake = { d, bin };
    const r = await runDesktopGate({ dir: fake.d, electron: fake.bin, pages: ['game.html'], timeoutMs: 20000, env: { MOJULO_SMOKE_TIMEOUT_MS: '60000' } });
    expect(r).toMatchObject({ ran: true, exit: 0, ok: true, t: '60000', pages: ['game.html'] });
    rmSync(d, { recursive: true, force: true });
  });
});
