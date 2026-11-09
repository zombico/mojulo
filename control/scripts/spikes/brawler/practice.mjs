#!/usr/bin/env node
// brawler practice — the practice yard played: the yard (brawlLevel 'yard' with a practice) built, resolved and
// emitted as its World page, then driven from the keyboard as a person would, on a virtual clock (each frame stepped by
// the spike, the keys set between frames): walk in, chain on a dummy, line up on a walker, the settings screen, the move
// list. The strong: the opener and the chain after it, then the blowout. The dashes, the long jump's flying kick, the
// dive kick. The eyes gate is the operator's: the shots.
//
//   node control/scripts/spikes/brawler/practice.mjs [--out dir] [--characters] [--register anime|western] [--armed] [--range] [--waves]
//
// --characters mints two characters into the spike's own scratch store (a wolf-kin hero, a mascot bear: a few minutes)
// and plays the wolf-kin against the bear, each in its own body, beside a fighter of the solver's (the operator's store
// is never touched); --register draws the yard in the fight's look (cel or lit, one key that casts), the characters
// played by their own clips; --armed the armed brawler (every hero its own weapon, the street laying none); --range the
// run & gun's range (the guns passed in: a stream, a shot aimed across, a shooter's warning stepped off, the rocket,
// a grenade, the guns' list); --waves the range's wave tester (its sampler: each wave in, its formation, a volley's
// warnings, then the wave felled for the next)
import { register as registerLoader, createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CONTROL = path.resolve(HERE, '../../..');
const { values: opt } = parseArgs({ options: { out: { type: 'string', default: path.join(os.tmpdir(), 'brawler-practice') }, characters: { type: 'boolean', default: false }, register: { type: 'string' }, armed: { type: 'boolean', default: false }, range: { type: 'boolean', default: false }, waves: { type: 'boolean', default: false } } });
const out = path.resolve(opt.out); mkdirSync(out, { recursive: true });
process.chdir(CONTROL);
registerLoader(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
process.env.SQLITE_PATH = path.join(out, 'store.db'); process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

const { brawlLevel } = await import('@/lib/graph/brawl/brawl-levels.js');
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three.js');
// (the characters, minted into the scratch store: the roster's first two)
let roster;
if (opt.characters) {
  const { createCharacterHandler } = await import('@/lib/mcp/tools/create-character.js');
  const wolf = await createCharacterHandler({ as: 'hero', title: 'Wolf-kin', spec: { cast: 'male', beast: { kin: 'lupine' }, palette: { Top: '#b8452e' } } });
  const bear = await createCharacterHandler({ as: 'mascot', title: 'Bear', spec: { brief: 'a round friendly bear', seed: 3 } });
  const arm = (w) => (opt.armed ? { weapon: w } : {});
  roster = [{ hero: { ref: wolf.ref }, style: 'grappler', name: 'Wolf-kin', ...arm('axe') }, { hero: { ref: bear.ref }, style: 'all-rounder', name: 'Bear', ...arm('staff') }, { id: 'kai', name: 'Kai', archetype: 'rushdown', ...arm('katana') }];
  console.log('characters', wolf.ref, bear.ref);
}
const manifest = brawlLevel({ kind: 'greybox', preset: 'yard' }, { title: 'practice', ...(opt.register ? { register: opt.register } : {}), ...(opt.armed ? { armed: true } : {}), practice: {
  ...(roster ? { roster, players: [0] } : {}),
  ...(opt.range || opt.waves ? { range: { guns: ['machine-gun', 'spread', 'flame', 'rocket'], grenades: 3, ...(opt.waves ? { waves: true } : {}) } } : {}),
  dummies: opt.waves ? [] : opt.range ? [{ mode: 'stand', at: 8, n: 0, type: 'rifleman' }, { mode: 'walk', at: 10, n: 1, type: 'gunner' }, { mode: 'shoot', at: 13, n: -0.4, type: 'rifleman' }] : roster ? [{ mode: 'stand', at: 7, n: 0, fighter: 1 }, { mode: 'walk', at: 9.5, n: 1, fighter: 2 }, { mode: 'swing', at: 12, n: -1, fighter: 1 }] : [{ mode: 'stand', at: 7, n: 0 }, { mode: 'walk', at: 9.5, n: 1 }, { mode: 'swing', at: 12, n: -1 }].map((d, i) => (opt.armed ? { ...d, type: ['sword', 'spear', 'axe'][i] } : d)),
  things: opt.range || opt.waves ? [] : [...(opt.armed ? [] : [{ kind: 'weapon', what: 'pipe', at: 5.5, n: 2 }]), { kind: 'food', what: 'chicken', at: 3, n: 2 }, { kind: 'box', what: 'barrel', at: 14, n: 1.6, holds: { kind: 'power', what: 'power' } }],
} });
const { payload } = await resolveWorldScene({ ref: 'practice', title: 'practice', manifest }, {});
writeFileSync(path.join(out, 'practice.html'), emitThreeWorld({ ...payload, hud: false, inline: true }));

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
await tab.goto(pathToFileURL(path.join(out, 'practice.html')).href, { waitUntil: 'load', timeout: 600000 });
for (let t = 0; !(await tab.evaluate(() => !!window.__mojBrawl).catch(() => false)); t++) { if (t > 40) { console.log('errors', JSON.stringify(errs.slice(0, 8))); throw new Error('the yard never started'); } await new Promise((r) => setTimeout(r, 500)); }
const play = (n, codes = []) => tab.evaluate(([n, codes]) => { window.__keys(codes); for (let i = 0; i < n; i++) window.__step(1000 / 60); }, [n, codes]);
const read = () => tab.evaluate(() => { const r = window.__mojBrawl.read; const p = window.__mojBrawl.room.s.bodies[0]; return { at: [p.x, p.z], st: p.st, mv: p.mv, chain: r.chain, log: r.log.slice(-4), line: r.line.map((d) => [d.id, d.dz, d.lined]) }; });
const shot = async (name) => { await tab.waitForTimeout(1200); await tab.screenshot({ path: path.join(out, `${name}.png`) }); };
const log = [];
await play(30);
await play(2, ['KeyK']); await play(10);   // (the keyboard sits down: attack, K)
await shot('yard');
if (opt.waves) {
  const wave = () => tab.evaluate(() => window.__mojBrawl.read.wave);
  for (let k = 0; k < 4; k++) {
    // (its wave in, to its stations, and a volley's warning showing)
    for (let t = 0; t < 400 && (await wave()).state !== 'on'; t++) await play(4);
    await play(110);
    for (let t = 0; t < 160 && !(await tab.evaluate(() => window.__mojBrawl.room.s.bodies.some((b) => b.side === 'crowd' && !b.gone && b.tl > 8))); t++) await play(2);
    const w = await wave();
    log.push([`wave ${w.n}`, { name: w.name, formation: w.formation, pattern: w.pattern, left: w.left }]);
    await shot(`wave-${w.n}`);
    // (felled for the next: a spike's shortcut, the wave cleared at once)
    await tab.evaluate(() => { for (const b of window.__mojBrawl.room.s.bodies) if (b.side === 'crowd' && !b.gone) { b.ko = 1; b.hp = 0; b.st = 'ko'; b.sf = 0; } });
    await play(10);
  }
  log.push(['cleared', (await wave()).cleared]);
  console.log(JSON.stringify(log));
  console.log('errors', JSON.stringify([...new Set(errs)].slice(0, 8)));
  await browser.close();
  console.log(out);
  process.exit(0);
}
if (opt.range) {
  const gun = () => tab.evaluate(() => { const r = window.__mojBrawl.read; return { gun: r.gun, log: r.log.slice(-3).map((e) => `${e.words} ${e.verdict} ${e.what ?? e.why}`) }; });
  // the stream held into the standing rifleman (K)
  await play(45, ['KeyK']);
  log.push(['stream', await gun()]);
  await shot('range-stream');
  // planted (I), aimed up the street at a slant at the walker (W D), firing
  await play(40, ['KeyI', 'KeyW', 'KeyD', 'KeyK']);
  log.push(['aimed across', await gun()]);
  await shot('range-aim');
  // the shooter's warning, then a step off its line (S, down the street)
  for (let k = 0; k < 120 && !(await tab.evaluate(() => window.__mojBrawl.room.s.bodies.some((b) => b.side === 'crowd' && b.tl > 12))); k++) await play(2);
  await shot('range-warning');
  await play(24, ['KeyS']); await play(40);
  log.push(['stepped off', await gun()]);
  // the settings: the Gun (the second field) to the rocket, and a rocket into them
  await play(2, ['Enter']); await play(6);
  await shot('range-settings');
  await play(2, ['KeyS']); await play(4);
  for (let k = 0; k < 3; k++) { await play(2, ['KeyD']); await play(4); }
  await play(2, ['Escape']); await play(6);
  await play(14, ['KeyK']); await play(16);
  log.push(['rocket', await gun()]);
  await shot('range-rocket');
  // a second rocket, stepped a frame at a time until its burst's impact frame shows (the picture flashed)
  await play(30, ['KeyK']);
  let impact = false;
  for (let k = 0; k < 120 && !impact; k++) { await play(1); impact = await tab.evaluate(() => document.getElementById('brawl-impact')?.style.display === 'block'); }
  log.push(['impact frame', impact]);
  if (impact) await tab.screenshot({ path: path.join(out, 'range-impact.png') });
  await play(20);
  // a grenade (L) over the near one, and a roll (S S) out
  await play(2, ['KeyL']); await play(40);
  await shot('range-grenade');
  await play(1, ['KeyS']); await play(2); await play(1, ['KeyS']); await play(10);
  log.push(['grenade, roll', await gun()]);
  // the guns' list (Escape)
  await play(2, ['Escape']); await play(6);
  await shot('range-moves');
  console.log(JSON.stringify(log));
  console.log('errors', JSON.stringify([...new Set(errs)].slice(0, 8)));
  await browser.close();
  console.log(out);
  process.exit(0);
}
// walk in to the standing dummy and chain on it
await play(75, ['KeyD']);
for (let k = 0; k < 6; k++) { await play(2, ['KeyK']); await play(5); }
log.push(['chain', await read()]);
await shot('chain');
// up onto the walker's line and in
await play(30, ['KeyW', 'KeyD']); await play(10);
log.push(['walker', await read()]);
await shot('line');
// the strong: back to the spots (R), in again, the opener (I) and the chain after it (K)
await play(2, ['KeyR']); await play(10);
await play(75, ['KeyD']);
await play(2, ['KeyI']); await play(14);
for (let k = 0; k < 5; k++) { await play(2, ['KeyK']); await play(5); }
log.push(['strong', await read()]);
await shot('strong');
// its cooldown run out, a jab and the blowout (toward, I): the dummy flung down the street
await play(90);
await play(2, ['KeyK']); await play(3); await play(2, ['KeyD', 'KeyI']); await play(20);
log.push(['blowout', await read()]);
await shot('blowout');
// the dashes: back to the spots, a back-step (A A), a run (D D held) into the running blow (K)
await play(2, ['KeyR']); await play(10);
await play(1, ['KeyA']); await play(2); await play(1, ['KeyA']); await play(8);
log.push(['back-step', await read()]);
await play(20);   // (the back-step over)
await play(1, ['KeyD']); await play(2); await play(18, ['KeyD']);
await shot('run');
await play(2, ['KeyD', 'KeyK']); await play(12);
log.push(['running blow', await read()]);
await shot('running-blow');
// in the air: back to the spots, a run and the long jump (J) into the flying kick (K); later a jump straight up, the
// air punch, and a jump forward, the dive kick (I)
await play(2, ['KeyR']); await play(10);
await play(1, ['KeyD']); await play(2); await play(10, ['KeyD']);
await play(2, ['KeyD', 'KeyJ']); await play(10, ['KeyD']); await play(2, ['KeyD', 'KeyK']); await play(4);
log.push(['flying kick', await read()]);
await shot('flying-kick');
await play(60);
await play(2, ['KeyD', 'KeyJ']); await play(10, ['KeyD']); await play(2, ['KeyI']); await play(4);
log.push(['dive kick', await read()]);
await shot('dive-kick');
// the settings, then the move list
await play(2, ['Enter']); await play(6);
await shot('settings');
await play(2, ['Escape']); await play(6);
await play(2, ['Escape']); await play(6);
await shot('moves');
await play(2, ['KeyD']); await play(6);
await shot('moves-strong');
console.log(JSON.stringify(log));
console.log('errors', JSON.stringify([...new Set(errs)].slice(0, 8)));
await browser.close();
console.log(out);
