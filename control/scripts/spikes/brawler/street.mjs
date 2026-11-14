#!/usr/bin/env node
// brawler street — THE STREET fought down on its page: the greybox street (brawlLevel 'street') with a `street` (who
// plays, a wave a held screen, the boss's), resolved and emitted as its World page, then played from the keyboard on a
// virtual clock by a bot that walks at the nearest body on the street, lines up and presses attack (K). What it answers:
// does the brawler's native kit play a street from its start to its end on a page, and does its screen say so (the
// health, the screens, GO, the boss, the end). The eyes gate is the operator's: the shots.
//
//   node control/scripts/spikes/brawler/street.mjs [--out dir] [--register anime|western] [--style all-rounder] [--secs 200] [--boss-hp 300] [--light]
import { register as registerLoader, createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CONTROL = path.resolve(HERE, '../../..');
const { values: opt } = parseArgs({ options: { out: { type: 'string', default: path.join(os.tmpdir(), 'brawler-street') }, register: { type: 'string' }, style: { type: 'string', default: 'all-rounder' }, secs: { type: 'string', default: '200' }, 'boss-hp': { type: 'string', default: '300' }, light: { type: 'boolean', default: false } } });
const out = path.resolve(opt.out); mkdirSync(out, { recursive: true });
process.chdir(CONTROL);
registerLoader(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
process.env.SQLITE_PATH = path.join(out, 'store.db'); process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

const { brawlLevel } = await import('@/lib/graph/brawl/brawl-levels.js');
const { BRAWL_ROSTER } = await import('@/lib/graph/brawl/brawl-page.js');
const { solveFighter } = await import('@/lib/graph/versus/versus-solver.js');
const { CPU_LEVELS } = await import('@/lib/graph/versus/versus-cpu.js');
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three.js');
const me = Math.max(0, BRAWL_ROSTER.findIndex((r) => r.id === opt.style));
const boss = { ...solveFighter({ id: 'boss', archetype: 'grappler' }).recipe, archetype: 'grappler', name: 'Big Rig' };
const manifest = brawlLevel({ kind: 'greybox', preset: 'street' }, { title: 'street', ...(opt.register ? { register: opt.register } : {}), street: {
  players: [me],
  // (--light: a street a masher can finish, to see its end)
  waves: opt.light ? [{ screen: 1, crowd: [{ type: 'thug', n: 2 }] }, { screen: 2, crowd: [{ type: 'thug', n: 2 }] }, { screen: 3, crowd: [], boss: { recipe: boss, plays: ['chain'], cpu: Object.keys(CPU_LEVELS)[0], hp: 150 } }]
    : [{ screen: 1, crowd: [{ type: 'thug', n: 4 }] }, { screen: 2, crowd: [{ type: 'thug', n: 3 }, { type: 'knife', n: 2 }] },
    { screen: 3, crowd: [{ type: 'thug', n: 2 }], boss: { recipe: boss, plays: ['chain', 'strong'], cpu: Object.keys(CPU_LEVELS)[0], hp: Number(opt['boss-hp']) } }],
} });
const { payload } = await resolveWorldScene({ ref: 'street', title: 'street', manifest }, {});
writeFileSync(path.join(out, 'street.html'), emitThreeWorld({ ...payload, hud: false, inline: true }));

const CLOCK = () => {
  let now = 0, next = [];
  window.requestAnimationFrame = (cb) => { next.push(cb); return next.length; };
  window.cancelAnimationFrame = () => {};
  performance.now = () => now;
  window.__step = (ms) => { now += ms; const run = next; next = []; for (const cb of run) { try { cb(now); } catch (e) { console.error('frame: ' + e.message + ' @ ' + String(e.stack).split('\n').slice(1, 4).join(' | ')); } } return now; };
  const held = new Set();
  window.__keys = (codes) => { for (const c of [...held]) if (!codes.includes(c)) { held.delete(c); window.dispatchEvent(new KeyboardEvent('keyup', { code: c })); } for (const c of codes) if (!held.has(c)) { held.add(c); window.dispatchEvent(new KeyboardEvent('keydown', { code: c })); } };
};
const { chromium } = createRequire(path.join(CONTROL, 'package.json'))('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
const tab = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
tab.on('pageerror', (e) => errs.push(e.message + ' @ ' + String(e.stack).split('\n').slice(1, 4).join(' | '))); tab.on('console', (m) => { if (m.type() === 'error' && !/AudioContext/.test(m.text())) errs.push(m.text()); });
await tab.addInitScript(CLOCK);
await tab.goto(pathToFileURL(path.join(out, 'street.html')).href, { waitUntil: 'load', timeout: 600000 });
for (let t = 0; !(await tab.evaluate(() => !!window.__mojBrawl).catch(() => false)); t++) { if (t > 40) { console.log('errors', JSON.stringify(errs.slice(0, 8))); throw new Error('the street never started'); } await new Promise((r) => setTimeout(r, 500)); }
const play = (n, codes = []) => tab.evaluate(([n, codes]) => { window.__keys(codes); for (let i = 0; i < n; i++) window.__step(1000 / 60); }, [n, codes]);
// the bot's read: where the player is, the nearest body standing on the street, what the screen says
const read = () => tab.evaluate(() => {
  const B = window.__mojBrawl, s = B.room.s, me = s.bodies[0], R = B.read;
  const on = s.bodies.filter((b) => b.side === 'crowd' && !b.gone && !b.ko).sort((a, b) => Math.abs(a.x - me.x) + Math.abs(a.z - me.z) - Math.abs(b.x - me.x) - Math.abs(b.z - me.z));
  return { me: [me.x, me.z], st: me.st, near: on[0] ? [on[0].x, on[0].z] : null, R, over: B.over, screen: B.ui.rt.state().screen, hud: document.querySelector('.mana-root') ? document.querySelector('.mana-root').innerText.replace(/\s+/g, ' ').slice(0, 160) : '' };
});
const shot = async (name) => { await tab.waitForTimeout(900); await tab.screenshot({ path: path.join(out, `${name}.png`) }); };
const log = [];
await play(30);
await play(2, ['KeyK']); await play(10);   // (the keyboard sits down: attack, K)
await shot('start');
let seen = { cleared: 0, boss: false, fights: 0 }, f = 0;
const frames = Number(opt.secs) * 60;
for (; f < frames; f += 2) {
  const s = await read();
  if (s.over) break;
  const keys = [];
  if (s.near) {
    const dx = s.near[0] - s.me[0], dz = s.near[1] - s.me[1];
    if (Math.abs(dx) > 700) keys.push(dx > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(dz) > 150) keys.push(dz > 0 ? 'KeyW' : 'KeyS');
    if (Math.abs(dx) < 1000 && Math.abs(dz) < 300 && f % 6 < 2) keys.push('KeyK');
  } else keys.push('KeyD');
  await play(2, keys);
  if (s.near && seen.fights < 3 && f > 300 && f % 600 === 0) { seen.fights++; await shot(`fight-${seen.fights}`); }
  if (s.R.cleared > seen.cleared) { seen.cleared = s.R.cleared; await play(20); await shot(`go-${s.R.cleared}`); log.push([`cleared ${s.R.cleared} of ${s.R.of}`, { t: +(f / 60).toFixed(1), hp: s.R.hp, hud: s.hud }]); }
  if (s.R.boss.on && !seen.boss) { seen.boss = true; await play(30); await shot('boss'); log.push(['boss', { t: +(f / 60).toFixed(1), name: s.R.boss.name, hp: s.R.boss.hp }]); }
}
await play(40);
await shot('end');
const last = await read();
// (what it sounded: each cue asked for, and which of them the page carries a sound for)
const sound = await tab.evaluate(() => { const B = window.__mojBrawl, has = new Set(B.cues); return { heard: B.heard, silent: Object.keys(B.heard).filter((c) => !has.has(c)), carried: B.cues.length }; });
log.push(['sound', sound]);
log.push(['end', { over: last.over, screen: last.screen, t: +(f / 60).toFixed(1), hp: last.R.hp, of: last.R.hpMax, cleared: `${last.R.cleared}/${last.R.of}`, hud: last.hud }]);
// (its end's button fights it again: accept, and the street is at its start)
if (last.over) { await play(2, ['KeyK']); await play(20); const again = await read(); log.push(['again', { over: again.over, screen: again.screen, cleared: again.R.cleared, hp: again.R.hp }]); }
for (const l of log) console.log(JSON.stringify(l));
console.log('errors', JSON.stringify(errs.slice(0, 8)));
await browser.close();
process.exit(0);
