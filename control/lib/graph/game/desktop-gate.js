/**
 * desktop-gate — the machine gate on a desktop export (`export_game { target: 'desktop' }`): launch the folder's
 * `main.js` under Electron in its `--mojulo-smoke` mode, which loads each page hidden and prints one
 * `MOJULO_SMOKE {json}` line (pages that failed, console errors, files the folder lacks), then quits.
 *
 * Advisory, like every gate: it stamps what it saw and refuses nothing. It says nothing about how the game looks
 * or plays; that is the eyes gate. Plain Node, no `@/` imports.
 */
import { spawn } from 'node:child_process';

const MARK = 'MOJULO_SMOKE ';

/** The pages worth loading: the shell, and the first level page (where the hoisted banks are fetched). */
export function smokePages(files) {
  const names = files.map((f) => (typeof f === 'string' ? f : f.file));
  const level = names.find((f) => /^levels\/(?!menu-|preview-)[^/]+\.html$/.test(f));
  return ['game.html', ...(level ? [level] : [])];
}

/** The report line out of Electron's stdout, or null. */
export function parseSmoke(stdout) {
  const line = String(stdout).split(/\r?\n/).find((l) => l.startsWith(MARK));
  if (!line) return null;
  try { return JSON.parse(line.slice(MARK.length)); } catch { return null; }
}

export function runDesktopGate({ dir, electron, pages, timeoutMs = 120000, log = () => {} }) {
  if (!electron) {
    return Promise.resolve({ ran: false, skipped: 'no Electron: set MOJULO_ELECTRON, put electron on the PATH, or run npm install in the folder' });
  }
  return new Promise((resolve) => {
    // an editor's terminal (VS Code, itself Electron) exports ELECTRON_RUN_AS_NODE, which would run main.js as plain Node
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(electron, [dir, '--mojulo-smoke', ...pages], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, timeoutMs);
    child.on('error', (e) => { clearTimeout(timer); resolve({ ran: false, skipped: `Electron did not start: ${e.message}` }); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const report = parseSmoke(stdout);
      if (!report) {
        log(stderr.slice(-2000));
        resolve({ ran: true, ok: false, exit: code, error: 'no MOJULO_SMOKE line (Electron exited before the report)', stderr: stderr.slice(-600) });
        return;
      }
      resolve({ ran: true, exit: code, ...report });
    });
  });
}
