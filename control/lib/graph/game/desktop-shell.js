/**
 * desktop-shell — the files that make an exported game folder an Electron app (`export_game { target: 'desktop' }`).
 *
 * The folder stays the web build: `game.html` still plays from any static server. Three files at its root add the
 * desktop app: `package.json` (Electron as the folder's own devDependency, never mojulo's), `main.js` (one window over
 * the folder) and `.gitignore`. `main.js` serves the folder over a privileged `game://` scheme rather than `file://`,
 * because the levels fetch their hoisted figure and geometry banks within the folder and Chromium refuses fetch on
 * `file:`; over the scheme, fetch, module scripts, iframes and audio behave as they do over HTTP.
 *
 * Pure functions of (title, ref, screen): same game, same bytes. Plain Node, no `@/` imports.
 */
import { readScreen } from './screen.js';

// The Electron major the exported folder installs. `protocol.handle` and `net.fetch` need 25 or newer; the pin is
// the major the smoke gate last ran against. Raising it changes every desktop export's package.json.
export const ELECTRON_TARGET = '^44.0.0';

// Engine packs and build output that share the outcome folder but are not the app.
const PACKAGER_IGNORE = '^/(dist|godot|unity|unreal)(/|$)';

const slug = (s, fallback) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || fallback;

/** The npm name: the title's slug plus the ref, so two games of one title keep separate saves. */
export function desktopAppName({ title, ref }) {
  return `${slug(title, 'mojulo-game')}-${slug(ref, 'game')}`;
}

export function desktopPackageJson({ title, ref }) {
  const pkg = {
    name: desktopAppName({ title, ref }),
    productName: String(title || 'Mojulo game'),
    version: '1.0.0',
    private: true,
    description: `${title || 'A game'}, exported from mojulo (game ref ${ref}). The recipes in recipe/ re-mint it.`,
    main: 'main.js',
    scripts: {
      start: 'electron .',
      package: `npx --yes @electron/packager . --out=dist --overwrite --ignore="${PACKAGER_IGNORE}"`,
    },
    devDependencies: { electron: ELECTRON_TARGET },
  };
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

export const DESKTOP_GITIGNORE = 'node_modules/\ndist/\n';

/**
 * The Electron main process. `--mojulo-smoke <page>…` is the machine gate's mode: each page loads in a hidden window,
 * and one `MOJULO_SMOKE {json}` line reports pages that failed, console errors and files the folder lacks.
 */
// the window a game opens in: 1280×800, or for a game made for a screen (screen.js) its frame fitted inside that, so
// a phone game opens upright (450×800) and a monitor game 16:9 (1280×720); the levels hold the frame either way
const WINDOW = { width: 1280, height: 800 };
export function desktopWindow(screen) {
  const S = screen == null ? null : readScreen(screen);
  if (!S) return WINDOW;
  const [w, h] = S.aspect, k = Math.min(WINDOW.width / w, WINDOW.height / h);
  return { width: Math.round(w * k), height: Math.round(h * k) };
}

export function desktopMainJs({ title, ref, screen = null }) {
  const size = desktopWindow(screen);
  return `// A desktop window over this folder, written by mojulo's export_game { target: 'desktop' }.
// The folder is also the web build: game.html plays from any static server. Here the window serves the folder over
// its own game:// scheme, so the levels' shared banks load as they would over HTTP, and nothing leaves the machine.
'use strict';
const { app, BrowserWindow, net, protocol, session, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = __dirname;
const TITLE = ${JSON.stringify(String(title || 'Mojulo game'))};
const APP_NAME = ${JSON.stringify(desktopAppName({ title, ref }))};
const smokeAt = process.argv.indexOf('--mojulo-smoke');
const SMOKE = smokeAt >= 0 ? process.argv.slice(smokeAt + 1).filter((a) => !a.startsWith('-')) : null;
const SETTLE_MS = Number(process.env.MOJULO_SMOKE_SETTLE_MS || 4000);
const TIMEOUT_MS = Number(process.env.MOJULO_SMOKE_TIMEOUT_MS || 90000);

// saves (the shell's localStorage) live under this game's own name, not the title another game may share
app.setPath('userData', path.join(app.getPath('appData'), APP_NAME));

protocol.registerSchemesAsPrivileged([
  { scheme: 'game', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true } },
]);

// A game:// URL to a file inside this folder, or null for anything that resolves outside it.
function resolveInFolder(url) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(url).pathname); } catch { return null; }
  const file = path.resolve(ROOT, '.' + pathname);
  return file.startsWith(ROOT + path.sep) ? file : null;
}

const missing = [];

app.whenReady().then(() => {
  protocol.handle('game', (request) => {
    const file = resolveInFolder(request.url);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      missing.push(request.url);
      return new Response('not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });
  // the game is offline: three.js and every asset are in the folder
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
    (_details, callback) => callback({ cancel: true }),
  );

  const win = new BrowserWindow({
    width: ${size.width},
    height: ${size.height},
    title: TITLE,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    show: !SMOKE,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: !SMOKE },
  });
  // outside links (the about page's) open in the browser; nothing else opens a window
  const outside = (url) => { if (/^https?:\\/\\//.test(url)) shell.openExternal(url); };
  win.webContents.setWindowOpenHandler(({ url }) => { outside(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('game://')) { event.preventDefault(); outside(url); }
  });

  if (SMOKE) smoke(win, SMOKE.length ? SMOKE : ['game.html']);
  else win.loadURL('game://app/game.html');
});

app.on('window-all-closed', () => app.quit());

function finish(report) {
  process.stdout.write('MOJULO_SMOKE ' + JSON.stringify(report) + '\\n');
  app.exit(report.ok ? 0 : 1);
}

async function smoke(win, pages) {
  const timer = setTimeout(() => finish({ ok: false, error: 'timed out after ' + TIMEOUT_MS + ' ms', missing }), TIMEOUT_MS);
  const report = { ok: false, electron: process.versions.electron, pages: [], missing };
  for (const page of pages) {
    const entry = { page, loaded: false, failed: [], errors: [] };
    const onFail = (_e, code, desc, url) => { if (code !== -3) entry.failed.push({ url, code, desc }); };
    // console-message: (event{level,message}) since Electron 35, (event, level, message) before it
    const onConsole = (event, level, message) => {
      const lv = event && event.level !== undefined ? event.level : level;
      const msg = event && typeof event.message === 'string' ? event.message : message;
      if (lv === 'error' || lv === 3) entry.errors.push(String(msg).slice(0, 300));
    };
    win.webContents.on('did-fail-load', onFail);
    win.webContents.on('console-message', onConsole);
    try {
      await win.loadURL('game://app/' + page);
      entry.loaded = true;
    } catch (e) {
      entry.failed.push({ url: page, desc: String((e && e.message) || e) });
    }
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    win.webContents.off('did-fail-load', onFail);
    win.webContents.off('console-message', onConsole);
    report.pages.push(entry);
  }
  clearTimeout(timer);
  report.ok = !missing.length && report.pages.every((p) => p.loaded && !p.failed.length && !p.errors.length);
  finish(report);
}
`;
}

/** The README section a desktop export adds after "How to play". */
export function desktopReadmeLines() {
  return [
    '## Play it as a desktop app',
    '',
    'This folder is also an Electron app:',
    '',
    '```bash',
    'npm install        # fetches Electron into this folder (about 300 MB unpacked on macOS arm64)',
    'npm start          # opens the game in its own window',
    'npm run package    # builds the app for this machine under dist/',
    '```',
    '',
    'The window serves this folder itself, so no web server is needed. It makes no network',
    'requests (outside links open in your browser), and saves stay in the app\'s own storage.',
    'The app is unsigned: macOS Gatekeeper and Windows SmartScreen warn on first open until',
    'you sign it with your own certificate.',
    '',
  ];
}
