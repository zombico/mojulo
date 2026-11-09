#!/usr/bin/env node
// fighter lab — the training lab on the training ground, played: a fighter carrying the new primitives (a rekka, a
// charged shot, a charged flip kick, a roll, an axe-kick overhead) baked onto the training ground under a register,
// hosted in training mode, and the first player driven from the keyboard as a person would (real time): the inputs run
// along the foot, F turns the frame meter on, the pause opens the move list in the player's own scheme. The eyes gate is
// the operator's: the shots.
//
//   node control/scripts/spikes/fighter/lab.mjs [--out dir] [--register anime|western] [--scheme classic|modern]
import { register as registerLoader, createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CONTROL = path.resolve(HERE, '../../..');
const { values: opt } = parseArgs({ options: { out: { type: 'string', default: path.join(os.tmpdir(), 'fighter-lab') }, register: { type: 'string', default: 'anime' }, scheme: { type: 'string', default: 'classic' } } });
const out = path.resolve(opt.out); mkdirSync(out, { recursive: true });
process.chdir(CONTROL);
registerLoader(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
process.env.SQLITE_PATH = path.join(out, 'store.db'); process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

const { solveFighter } = await import('@/lib/graph/versus/versus-solver.js');
const { fightLevel } = await import('@/lib/graph/versus/versus-levels.js');
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three.js');
const base = solveFighter({ id: 'kai', archetype: 'all-rounder' }).recipe;
const kai = { ...base, id: 'kai', name: 'Kai', commands: { 'forward.M': { family: 'axe' } }, specials: { forward: { id: 'rekka' }, back: { id: 'boom' }, down: { id: 'flash' }, neutral: { id: 'roll' } } };
// (the training partner: in the game, the second pick at character select; here, the spike's stand-in)
const dummy = { ...solveFighter({ id: 'partner', archetype: 'all-rounder' }).recipe, id: 'partner', name: 'Partner' };
const manifest = fightLevel({ kind: 'greybox', preset: 'training' }, { roster: [{ ...kai, color: '#d9532b' }, { ...dummy, color: '#3f7fd0' }], title: 'lab', register: opt.register });
const { payload } = await resolveWorldScene({ ref: 'lab', title: 'lab', manifest }, { live: true });
writeFileSync(path.join(out, 'lab.html'), emitThreeWorld({ ...payload, hud: false, inline: true }));
const picks = { fighters: [kai, dummy], names: ['Kai', 'Partner'], colors: ['#d9532b', '#3f7fd0'], characters: [null, null], schemes: [opt.scheme, 'modern'], mode: 'training', level: 1, seed: 7 };
const W = payload.versus.wire;
writeFileSync(path.join(out, 'host.html'), `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#000}iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style>
<iframe id="f" src="lab.html"></iframe><script>
const W = ${JSON.stringify(W)}, picks = ${JSON.stringify(picks).replace(/</g, '\\u003c')}, f = document.getElementById('f');
addEventListener('message', (e) => { if (e.source === f.contentWindow && e.data && e.data.moj === W.ready) f.contentWindow.postMessage({ moj: W.init, contractVersion: W.version, params: { versus: picks }, seed: picks.seed }, '*'); });
</script>`);

// the arena on a virtual clock (as styles.mjs): each fight frame stepped by the spike, the keys set between frames
const CLOCK = () => {
  if (window.parent === window) return;
  let now = 0, next = [];
  window.requestAnimationFrame = (cb) => { next.push(cb); return next.length; };
  window.cancelAnimationFrame = () => {};
  performance.now = () => now;
  window.__step = (ms) => { now += ms; const run = next; next = []; for (const cb of run) { try { cb(now); } catch (e) { console.error('frame: ' + e.message); } } return now; };
  const held = new Set();
  // the keys down for the next frames: what was down and is not now goes up
  window.__keys = (codes) => { for (const c of [...held]) if (!codes.includes(c)) { held.delete(c); window.dispatchEvent(new KeyboardEvent('keyup', { code: c })); } for (const c of codes) if (!held.has(c)) { held.add(c); window.dispatchEvent(new KeyboardEvent('keydown', { code: c })); } };
};
const { chromium } = createRequire(path.join(CONTROL, 'package.json'))('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
const tab = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
tab.on('pageerror', (e) => errs.push(e.message)); tab.on('console', (m) => { if (m.type() === 'error' && !/AudioContext/.test(m.text())) errs.push(m.text()); });
await tab.addInitScript(CLOCK);
await tab.goto(pathToFileURL(path.join(out, 'host.html')).href, { waitUntil: 'load', timeout: 600000 });
const arena = () => tab.frames().find((f) => f !== tab.mainFrame());
for (let t = 0; !(arena() && await arena().evaluate(() => !!window.__step).catch(() => false)); t++) { if (t > 600) throw new Error('the arena never started'); await new Promise((r) => setTimeout(r, 500)); }
// n fight frames with these keys down
const play = (n, codes = []) => arena().evaluate(([n, codes]) => { window.__keys(codes); for (let i = 0; i < n; i++) window.__step(1000 / 60); }, [n, codes]);
const read = () => arena().evaluate(() => ({ phase: window.__mojVersus.phase, mv: window.__mojVersus.match && window.__mojVersus.match.s.p[0].mv, st: window.__mojVersus.match && window.__mojVersus.match.s.p[0].st }));
await play(200);   // (the handshake and the round's intro)
await play(2, ['Space']); await play(10);   // (the keyboard sits down)
const log = [];
// a quarter circle forward + medium, three times, each in the stage before's active frames: the rekka
const qcf = async (btn) => { await play(2, ['KeyS']); await play(2, ['KeyS', 'KeyD']); await play(2, ['KeyD', btn]); };
await qcf('KeyK'); log.push(['rekka 1', await read()]); await play(8);
await qcf('KeyK'); log.push(['rekka 2', await read()]); await play(8);
await qcf('KeyK'); await play(4); await qcf('KeyK'); log.push(['rekka 3', await read()]); await play(70);
// the frame meter on (F), then the overhead: forward + medium
await play(2, ['KeyF']); await play(2);
await play(3, ['KeyD', 'KeyK']); log.push(['axe', await read()]); await play(70);
// back held (a charge), then forward + heavy: the charged shot
await play(48, ['KeyA']); await play(3, ['KeyD', 'KeyL']); log.push(['boom', await read()]); await play(30);
await tab.waitForTimeout(1500); await tab.screenshot({ path: path.join(out, 'lab.png') });
// the pause, down to the move list, open it; right to the specials
await play(2, ['Enter']); await play(4);
await play(2, ['KeyS']); await play(4);
await play(2, ['KeyJ']); await play(10);
log.push(['moves', await read()]);
await tab.waitForTimeout(1500); await tab.screenshot({ path: path.join(out, 'movelist.png') });
for (let k = 0; k < 2; k++) { await play(2, ['KeyD']); await play(6); }
await play(2, ['KeyS']); await play(6);
await tab.waitForTimeout(1500); await tab.screenshot({ path: path.join(out, 'movelist-specials.png') });
console.log(JSON.stringify(log));
console.log('errors', JSON.stringify([...new Set(errs)].slice(0, 6)));
await browser.close();
console.log(out);
