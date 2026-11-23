#!/usr/bin/env node
/**
 * `node scripts/view.mjs [--port 3002]` — the game view (lib/view/): mojulo's work as a person sees it, games first, every
 * level's gates beside it. A `node:http` server over pure renderers, no framework, no dependency: the store is read
 * where the CLI reads it (resolveMojuloPaths), and the one write is the person's eyes stamp on a level they played.
 *
 *   GET  /                    the games                GET  /games/<ref>     a game: its path to level 1, levels, cast
 *   GET  /levels              every level              GET  /levels/<ref>    a level: play it, its gates, the stamp
 *   POST /levels/<ref>/eyes   the person's verdict     GET  /play/<ref>      the level's own page (the iframe's)
 *   GET  /characters          heroes, foes, figures    GET  /objects         everything else
 *   GET  /vendor/three/…      three.js, as a level's page imports it
 *
 * `--warm` runs the warmer alone (each game's path, each level's still check) and exits.
 */
import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { register } from 'node:module';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

register('./mcp-stdio-loader.mjs', import.meta.url);
resolveMojuloPaths();
const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(CONTROL_DIR);

const { values: args } = parseArgs({ options: { port: { type: 'string', default: '3002' }, host: { type: 'string', default: '127.0.0.1' }, warm: { type: 'boolean', default: false } } });
const D = await import('@/lib/view/data.js');
const V = await import('@/lib/view/verify.js');
const P = await import('@/lib/view/pages.js');

async function levelRows(G) {
  const rows = {};
  for (const l of G.levels) {
    const r = D.row(l.ref);
    if (!r) { rows[l.ref] = { title: l.ref, gates: [{ id: 'stored', kind: 'machine', status: 'fail', says: 'the level is not in the store' }] }; continue; }
    const S = V.stillNow(r);
    if (!S) warmSoon();
    rows[l.ref] = { title: r.title || l.ref, gates: V.gates(l, r, { still: S }) };
  }
  for (const c of G.characters) rows[c] = { title: D.row(c)?.manifest?.hero?.name || D.row(c)?.title || c };
  return rows;
}
// THE WARMER (`--warm`): a process of its own that reads each game's path (design_game's readout) and runs the still
// check on each of its levels, writing each result to the view's record as it lands (verify.js); the server reads the
// record and never waits. Spawned at start, and again when a page finds something not yet read.
let warming = null;
function warmSoon() {
  if (warming) return;
  warming = spawn(process.execPath, [fileURLToPath(import.meta.url), '--warm'], { stdio: 'ignore', env: process.env });
  warming.on('exit', () => { warming = null; });
}
async function warmAll() {
  const { designGameHandler } = await import('@/lib/mcp/tools/design-game.js');
  const all = D.games();
  for (const g of all) {
    if (g.kind !== 'gameworld') continue;
    const r = D.row(g.ref), print = D.printOf(r);
    if (V.readoutNow(g.ref, print)) continue;
    try { V.recordReadout(g.ref, print, await designGameHandler({ ref: g.ref })); } catch { /* left unread */ }
  }
  // (a game's levels first, then every level on its own)
  for (const ref of [...new Set([...all.flatMap((g) => g.levels), ...D.levels().map((l) => l.ref)])]) {
    const r = D.row(ref);
    if (r && !V.stillNow(r)) V.recordStill(r, await V.still(r));
    if (r && !fs.existsSync(playFile(r))) await writePlay(r);
  }
}
// a level's own page, built once as stored (seconds to a minute, megabytes) and served from a file
const playFile = (r) => path.join(process.env.MOJULO_DATA_DIR || 'data', 'view-play', `${r.ref}-${D.printOf(r)}.html`);
async function writePlay(r) {
  try {
    const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
    const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
    const { payload } = await resolveWorldScene(r);
    fs.mkdirSync(path.dirname(playFile(r)), { recursive: true });
    fs.writeFileSync(`${playFile(r)}.tmp`, emitThreeWorld(payload)); fs.renameSync(`${playFile(r)}.tmp`, playFile(r));
  } catch { /* left unbuilt: the page says so */ }
}
const WAIT = (what) => `<!doctype html><meta http-equiv="refresh" content="5"><body style="font:15px system-ui;color:#9aa0a6;background:#000;display:grid;place-items:center;height:100vh;margin:0">${what}</body>`;
const readoutNow = (ref) => { const R = V.readoutNow(ref, D.printOf(D.row(ref))); if (!R) warmSoon(); return R; };
function levelInGame(ref) {
  for (const g of D.games()) { const G = D.gameOf(g.ref); const l = G?.levels.find((x) => x.ref === ref); if (l) return { of: g.ref, level: l }; }
  return { of: null, level: { ref } };
}

const routes = [
  ['GET', /^\/$/, async () => P.gamesPage(D.games())],
  ['GET', /^\/games\/([^/]+)$/, async (ref) => {
    const G = D.gameOf(ref);
    if (!G) return null;
    return P.gamePage({ G, readout: G.row.manifest?.kind === 'gameworld' ? readoutNow(ref) : null, rows: await levelRows(G) });
  }],
  ['GET', /^\/levels$/, async () => P.levelsPage(D.levels())],
  ['GET', /^\/levels\/([^/]+)$/, async (ref) => {
    const r = D.row(ref);
    if (!r) return null;
    const { of, level } = levelInGame(ref), S = V.stillNow(r);
    if (!S) warmSoon();
    const mechanics = (r.manifest?.game?.mechanics ?? []).map((x) => x?.kind).filter(Boolean);
    const ends = S?.ends ?? Object.entries(r.manifest?.game?.on ?? {}).filter(([, v]) => v && v.end).map(([event, v]) => ({ event, end: v.end }));
    return P.levelPage({ r, of, gates: V.gates(level, r, { still: S }), ends, mechanics });
  }],
  ['GET', /^\/play\/([^/]+)$/, async (ref) => {
    const r = D.row(ref);
    if (!r) return null;
    if (fs.existsSync(playFile(r))) return { file: playFile(r) };
    warmSoon();
    return WAIT('Building the level\'s page: it plays here in a moment.');
  }],
  ['GET', /^\/characters$/, async () => P.charactersPage(D.characters())],
  ['GET', /^\/objects$/, async () => P.objectsPage(D.objects())],
];

const body = (req) => new Promise((ok) => { let s = ''; req.on('data', (c) => { s += c; if (s.length > 1e5) req.destroy(); }); req.on('end', () => ok(s)); });

if (args.warm) { await warmAll(); process.exit(0); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = decodeURIComponent(url.pathname);
  try {
    const eyes = req.method === 'POST' && /^\/levels\/([^/]+)\/eyes$/.exec(p);
    if (eyes) {
      const f = new URLSearchParams(await body(req));
      V.stampEyes(D.row(eyes[1]), { verdict: f.get('verdict'), note: f.get('note') || '' });
      res.writeHead(303, { location: `/levels/${encodeURIComponent(eyes[1])}` }); res.end(); return;
    }
    // three.js as the level's page imports it (its import map: /vendor/three/…), from the package's own copy
    if (req.method === 'GET' && p.startsWith('/vendor/three/')) {
      const root = path.join(CONTROL_DIR, 'public', 'vendor', 'three'), f = path.resolve(root, '.' + p.slice('/vendor/three'.length));
      if (f.startsWith(root + path.sep) && fs.existsSync(f) && fs.statSync(f).isFile()) {
        res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream', 'cache-control': 'max-age=86400' });
        fs.createReadStream(f).pipe(res); return;
      }
    }
    for (const [method, rx, fn] of routes) {
      const m = req.method === method && rx.exec(p);
      if (!m) continue;
      const html = await fn(...m.slice(1));
      if (html == null) break;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      if (html.file) fs.createReadStream(html.file).pipe(res); else res.end(html);
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' }); res.end(`error: ${err?.message ?? err}`);
  }
});
server.listen(Number(args.port), args.host, () => {
  process.stderr.write(`mojulo view: http://${args.host}:${args.port}/\n`);
  // the still check for every level a game made, in the background, newest first (the view never waits on it)
  warmSoon();
});
