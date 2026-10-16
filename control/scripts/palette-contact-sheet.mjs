#!/usr/bin/env node
/**
 * Paint palettes side by side (color-theorist/contact.js) and measure their spread, the test of the color theorist's
 * thesis: do they read as different games, or is there a house look?
 *
 *   node scripts/palette-contact-sheet.mjs [--out sheet.html] [--seed 1]
 *
 * Sections: the auto default (what a world naming nothing gets, 20 seeds); ten intents at five seeds each (the
 * agent's reading of each intent is written below, as the agent would pass it); 20 rolled through the novelty ledger,
 * each looking away from the ones before; each colour script across one world's five levels; and each space preset. Writes one HTML page (to the
 * system's temp folder unless --out) and prints each section's spread.
 */
import { writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

register('./mcp-stdio-loader.mjs', import.meta.url);
const args = process.argv.slice(2), flag = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const out = flag('--out', path.join(tmpdir(), 'palette-contact-sheet.html')), base = Number(flag('--seed', 1));
const { solvePalette, scriptShift, PALETTE_SCRIPTS, PALETTE_PRESETS } = await import('../lib/graph/color-theorist/solve.js');
const { novelSeed, signatureOf, paletteDistance } = await import('../lib/graph/color-theorist/ledger.js');
const { contactSheet, sheetStats } = await import('../lib/graph/color-theorist/contact.js');

// the agent's reading of each intent: heat (cool −1 … warm 1), weight (light −1 … heavy 1), activity (calm −1 … active 1)
const INTENTS = [
  ['a drowned town at dusk', { heat: -0.5, weight: 0.6, activity: -0.3 }],
  ['a desert at noon', { heat: 0.9, weight: -0.6, activity: 0.2 }],
  ['a cosy autumn village', { heat: 0.6, weight: 0.1, activity: 0.1 }],
  ['a frozen northern coast', { heat: -0.8, weight: -0.3, activity: -0.5 }],
  ['a neon market in the rain', { heat: -0.2, weight: 0.5, activity: 0.9 }],
  ['a haunted moor', { heat: -0.4, weight: 0.7, activity: -0.7 }],
  ['a toy kingdom in candy colours', { heat: 0.3, weight: -0.8, activity: 0.8 }],
  ['a volcanic forge', { heat: 1, weight: 0.8, activity: 0.7 }],
  ['a quiet stone garden', { heat: 0.1, weight: -0.4, activity: -0.8 }],
  ['an alien jungle', { heat: 0, weight: 0.2, activity: 0.9 }],
];
// reproducible dice for the ledger's rolls (the real door rolls the system's)
let s = base * 2654435761 >>> 0;
const roll = () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return (s % 2147483646) + 1; };

const auto = Array.from({ length: 20 }, (_, i) => ({ label: `auto · seed ${base + i}`, contract: solvePalette({ seed: base + i }) }));
// each intent its own seeds (shared seeds would roll the same scheme and hue jitter across intents)
const intents = INTENTS.flatMap(([intent, axes], j) => Array.from({ length: 5 }, (_, i) => { const seed = base + 100 + j * 10 + i; return { label: `${intent} · ${seed}`, contract: solvePalette({ intent, ...axes, seed }) }; }));
const recent = [], ledger = [];
for (let i = 0; i < 20; i += 1) {
  const seed = novelSeed({}, { recent, roll }), K = solvePalette({ seed });
  ledger.push({ label: `ledger · #${i + 1} · seed ${seed}`, contract: K });
  recent.push(signatureOf(K));
}
const world = { seed: base + 7 }, widest = (rows) => { const g = rows.map((r) => signatureOf(r.contract)); return Math.max(...g.flatMap((a, i) => g.slice(i + 1).map((b) => paletteDistance(a, b)))); };
const scripts = Object.entries(PALETTE_SCRIPTS).map(([arc, S]) => {
  const rows = Array.from({ length: 5 }, (_, i) => { const shift = scriptShift(arc, i, 5); return { label: `${arc} · level ${i + 1} of 5`, contract: solvePalette(shift ? { ...world, shift } : world) }; });
  return { title: `Colour script: ${arc}`, says: `${S.says}. One world (seed ${world.seed}) across five levels; its widest two levels ${widest(rows).toFixed(3)} apart.`, rows, stats: false };
});

// space: each preset at four seeds (thin air and vacuum paint into the cratered plain)
const space = Object.entries(PALETTE_PRESETS).map(([preset, P]) => ({ title: `Space: ${preset}`, says: P.says, rows: [1, 2, 3, 4].map((i) => ({ label: `${preset} · seed ${base + 200 + i}`, contract: solvePalette({ preset, seed: base + 200 + i }) })), stats: false }));

const sections = [
  { title: 'The auto default', says: 'What a world that names no kit, look or palette gets from its seed alone (a new world\'s seed is rolled through the ledger below).', rows: auto },
  { title: 'Ten intents, five seeds each', says: 'The axes are the agent\'s reading of the words; the seed rolls the rest. One identity per intent, five variations?', rows: intents },
  { title: 'Through the novelty ledger', says: 'Twenty auto palettes rolled in order, each seed the farthest of eight from the ones before.', rows: ledger },
  ...scripts,
  ...space,
];
writeFileSync(out, contactSheet(sections, { title: 'Palette contact sheet' }));
// across intents: each palette's nearest from ANOTHER intent (twins within an intent are its identity holding)
const across = intents.map((r, i) => { const a = signatureOf(r.contract), j0 = Math.floor(i / 5); return Math.min(...intents.filter((_, j) => Math.floor(j / 5) !== j0).map((q) => paletteDistance(a, signatureOf(q.contract)))); });
const within = intents.map((r, i) => { const a = signatureOf(r.contract), j0 = Math.floor(i / 5); return Math.max(...intents.filter((_, j) => Math.floor(j / 5) === j0 && j !== i).map((q) => paletteDistance(a, signatureOf(q.contract)))); });
console.log(`Intents: twins across intents ${across.filter((d) => d < 0.04).length} of ${across.length} · the widest within an intent ${Math.max(...within).toFixed(3)}`);
for (const S of scripts) console.log(`${S.title.padEnd(30)} ${S.says.split('; ').at(-1)}`);
for (const S of sections.filter((x) => x.stats !== false)) {
  const T = sheetStats(S.rows.map((r) => r.contract));
  console.log(`${S.title.padEnd(30)} n ${T.n} · nearest median ${T.nearest.median} least ${T.nearest.least} twins ${T.nearest.twins} · ground bins ${T.ground.used}/12 top ${T.ground.top} · sky bins ${T.sky.used} · keys ${JSON.stringify(T.keys)} · schemes ${Object.keys(T.schemes).length}`);
}
console.log(`wrote ${out}`);
