#!/usr/bin/env node
// arena gameplay — a versus match in 3D, recorded: two characters minted through the hero door (create_character, into
// a scratch store), fighting with their own strikes (versus-hero.js, `moves: 'hero'`) on an arena (versus-arena.js: a
// stage set, the fight's World page), each in its own body; the arena hosted by a small page that sends it the picks as a
// versus game's front does (the level wire), CPU against CPU; recorded by headless Chromium, cut to an MP4 and a GIF.
//
//   node control/scripts/spikes/fighter/arena-gameplay.mjs [--a spec.json] [--b spec.json] [--kit island-plaza] [--set ring]
//        [--seconds 24] [--out dir] [--reuse]
//
// --reuse keeps the minted characters and the baked arena page of a run before (re-record only); --reemit emits the page
// again from the run's baked scene (a change to the arena's own page code, no bake). Needs Playwright's
// Chromium and ffmpeg. A mint takes about two minutes a character (the realistic head). The capture steps the page on a
// virtual clock and shoots every other frame (30 a second of game time), so it is slow to make and true to the game.
import { register, createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CONTROL = path.resolve(HERE, '../../..');
const { values: opt } = parseArgs({ options: { a: { type: 'string', default: path.join(HERE, 'test-fighter.json') }, b: { type: 'string', default: path.join(HERE, 'test-opponent.json') }, kit: { type: 'string' }, set: { type: 'string' }, seconds: { type: 'string', default: '24' }, out: { type: 'string', default: path.join(os.tmpdir(), 'fighter-arena') }, reuse: { type: 'boolean', default: false }, reemit: { type: 'boolean', default: false } } });
const out = path.resolve(opt.out); mkdirSync(out, { recursive: true });
const arenaFile = path.join(out, 'arena.html'), picksFile = path.join(out, 'picks.json');

if (opt.reemit && existsSync(path.join(out, 'payload.json'))) {
  process.chdir(CONTROL);
  register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
  const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three.js');
  writeFileSync(arenaFile, emitThreeWorld({ ...JSON.parse(readFileSync(path.join(out, 'payload.json'), 'utf8')), hud: false, inline: true }));
  console.log('the arena page emitted again from its baked scene');
} else if (!(opt.reuse && existsSync(arenaFile) && existsSync(picksFile))) {
  const specs = [opt.a, opt.b].map((f) => { const { motion: _m, ...s } = JSON.parse(readFileSync(path.resolve(f), 'utf8')); return s; });
  process.chdir(CONTROL);
  register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
  process.env.SQLITE_PATH = path.join(out, 'store.db'); process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
  process.env.MOJULO_OUTCOMES_DIR = path.join(out, 'outcomes');
  const { createCharacterHandler } = await import('@/lib/mcp/tools/create-character.js');
  const { arenaManifest } = await import('@/lib/graph/versus/versus-arena.js');
  const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene.js');
  const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three.js');
  const refs = [];
  for (const [i, spec] of specs.entries()) {
    console.log(`minting fighter ${i + 1} …`);
    const r = await createCharacterHandler({ as: 'hero', spec });
    if (!r.ok) throw new Error(`the door refused fighter ${i + 1}: ${JSON.stringify(r.error ?? r).slice(0, 600)}`);
    refs.push(r.ref);
  }
  const roster = [
    { id: 'toji', name: 'Toji', tradition: 'boxing', hero: { ref: refs[0] }, moves: 'hero', color: '#c8302c' },
    { id: 'satoru', name: 'Satoru', tradition: 'boxing', hero: { ref: refs[1] }, moves: 'hero', color: '#2f5fbf' },
  ];
  console.log('baking the arena …');
  const { payload } = await resolveWorldScene({ ref: 'arena', title: 'Fighter wiring', manifest: arenaManifest({ ...(opt.kit ? { kit: opt.kit } : {}), ...(opt.set ? { set: opt.set } : {}), roster, title: 'Fighter wiring' }) }, { live: true });
  writeFileSync(arenaFile, emitThreeWorld({ ...payload, hud: false, inline: true }));
  // (the baked scene kept, so a change to the page's own code is emitted again without a bake: --reemit)
  writeFileSync(path.join(out, 'payload.json'), JSON.stringify(payload));
  const R = payload.versus.roster;
  writeFileSync(picksFile, JSON.stringify({ wire: payload.versus.wire, picks: { fighters: R.map((e) => e.recipe), names: R.map((e) => e.name), colors: R.map((e) => e.color), characters: R.map((e) => e.character ?? null), schemes: ['modern', 'modern'], mode: 'watch', level: 1, seed: 7 } }));
}

// the host: a versus game's front in miniature, answering the arena's READY with the picks (CPU against CPU)
const { wire, picks } = JSON.parse(readFileSync(picksFile, 'utf8'));
writeFileSync(path.join(out, 'host.html'), `<!doctype html><meta charset="utf-8"><title>Arena host</title>
<style>html,body{margin:0;height:100%;background:#000}iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style>
<iframe id="f" src="arena.html"></iframe>
<script>
const W = ${JSON.stringify(wire)}, picks = ${JSON.stringify(picks).replace(/</g, '\\u003c')}, f = document.getElementById('f');
addEventListener('message', (e) => { if (e.source === f.contentWindow && e.data && e.data.moj === W.ready) f.contentWindow.postMessage({ moj: W.init, contractVersion: W.version, params: { versus: picks }, seed: picks.seed }, '*'); });
</script>`);

// THE CAPTURE, frame by frame on a virtual clock: software rendering draws this page at a few frames a second, so a
// recording in real time plays the fight in slow motion. Every frame's clock and animation callbacks are the script's:
// it steps the game a sixtieth of a second at a time and shoots every second step, so the video runs at the game's own
// pace however slow the drawing is.
const CLOCK = () => {
  // (the arena's frame alone: the host's own animation frames are the screenshots')
  if (window.parent === window) return;
  let now = 0, next = [];
  const t0 = Date.now();
  window.requestAnimationFrame = (cb) => { next.push(cb); return next.length; };
  window.cancelAnimationFrame = () => {};
  performance.now = () => now;
  Date.now = () => t0 + now;
  // (a frame's pixels read in the task that drew it, before the compositor takes the WebGL buffer: the 3D canvas, then
  // the overlays over it, in the page's order)
  window.__shot = () => {
    const c = document.createElement('canvas'); c.width = innerWidth; c.height = innerHeight; const g = c.getContext('2d');
    for (const k of document.querySelectorAll('canvas')) { const r = k.getBoundingClientRect(); if (r.width > 0 && r.height > 0) g.drawImage(k, r.left, r.top, r.width, r.height); }
    return c.toDataURL('image/jpeg', 0.9);
  };
  window.__step = (ms) => { now += ms; const run = next; next = []; for (const cb of run) { try { cb(now); } catch (e) { console.error('frame: ' + e.message); } } return now; };
};
const { chromium } = createRequire(path.join(CONTROL, 'package.json'))('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
const tab = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; tab.on('pageerror', (e) => errs.push(e.message)); tab.on('console', (m) => { if (m.type() === 'error' && !/AudioContext/.test(m.text())) errs.push(m.text()); });
await tab.addInitScript(CLOCK);
await tab.goto(pathToFileURL(path.join(out, 'host.html')).href, { waitUntil: 'load', timeout: 300000 });
const arena = () => tab.frames().find((f) => f !== tab.mainFrame());
// (the arena is its own frame, an opaque file:// origin the host cannot reach into: ask the frame itself)
for (let t = 0; !(arena() && await arena().evaluate(() => !!window.__step).catch(() => false)); t++) { if (t > 600) throw new Error('arena: its frame never started'); await new Promise((r) => setTimeout(r, 500)); }
const step = (n) => arena().evaluate((n) => { for (let i = 0; i < n; i++) window.__step(1000 / 60); }, n);
// the handshake and the round's intro, unshot
await step(150);
const frames = path.join(out, 'frames'); mkdirSync(frames, { recursive: true });
const N = Math.round(Number(opt.seconds) * 30);
for (let k = 0; k < N; k++) {
  const url = await arena().evaluate(() => { window.__step(1000 / 60); window.__step(1000 / 60); return window.__shot(); });
  writeFileSync(path.join(frames, `${String(k).padStart(5, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
  if (k % 60 === 0) console.log(`frame ${k} / ${N}`);
}
await browser.close();
const mp4 = path.join(out, 'arena.mp4'), gif = path.join(out, 'arena.gif');
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(frames, '%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', mp4], { stdio: 'inherit' });
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(frames, '%05d.jpg'), '-t', '10', '-vf', 'fps=15,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer', gif], { stdio: 'inherit' });
if (errs.length) console.error(`page errors: ${[...new Set(errs)].slice(0, 4).join(' | ')}`);
console.log(mp4); console.log(gif);
