#!/usr/bin/env node
// brawler practice — the practice yard played: the yard (brawlLevel 'yard' with a practice) built, resolved and
// emitted as its World page, then driven from the keyboard as a person would, on a virtual clock (each frame stepped by
// the spike, the keys set between frames): walk in, chain on a dummy, line up on a walker, the settings screen, the move
// list. The strong: the opener and the chain after it, then the blowout. The eyes gate is the operator's: the shots.
//
//   node control/scripts/spikes/brawler/practice.mjs [--out dir] [--characters] [--register anime|western]
//
// --characters mints two characters into the spike's own scratch store (a wolf-kin hero, a mascot bear: a few minutes)
// and plays the wolf-kin against the bear, each in its own body, beside a fighter of the solver's (the operator's store
// is never touched); --register draws the yard in the fight's look (cel or lit, one key that casts), the characters
// played by their own clips
import { register as registerLoader, createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CONTROL = path.resolve(HERE, '../../..');
const { values: opt } = parseArgs({ options: { out: { type: 'string', default: path.join(os.tmpdir(), 'brawler-practice') }, characters: { type: 'boolean', default: false }, register: { type: 'string' } } });
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
  roster = [{ hero: { ref: wolf.ref }, style: 'grappler', name: 'Wolf-kin' }, { hero: { ref: bear.ref }, style: 'all-rounder', name: 'Bear' }, { id: 'kai', name: 'Kai', archetype: 'rushdown' }];
  console.log('characters', wolf.ref, bear.ref);
}
const manifest = brawlLevel({ kind: 'greybox', preset: 'yard' }, { title: 'practice', ...(opt.register ? { register: opt.register } : {}), practice: {
  ...(roster ? { roster, players: [0] } : {}),
  dummies: roster ? [{ mode: 'stand', at: 7, n: 0, fighter: 1 }, { mode: 'walk', at: 9.5, n: 1, fighter: 2 }, { mode: 'swing', at: 12, n: -1, fighter: 1 }] : [{ mode: 'stand', at: 7, n: 0 }, { mode: 'walk', at: 9.5, n: 1 }, { mode: 'swing', at: 12, n: -1 }],
  things: [{ kind: 'weapon', what: 'pipe', at: 5.5, n: 2 }, { kind: 'food', what: 'chicken', at: 3, n: 2 }, { kind: 'box', what: 'barrel', at: 14, n: 1.6, holds: { kind: 'power', what: 'power' } }],
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
