#!/usr/bin/env node
/**
 * The lorecube's drawings, from its data (lib/graph/lorecube/diagram.js): each named polarity and a few sample
 * reserves, written as SVG under docs/lorecube/. Regenerate after changing a polarity, a root or a gauge:
 *
 *   node scripts/lorecube-diagrams.mjs [--check]     --check: say which drawing is stale, write nothing
 */
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
if (!process.env.VITEST) register('./mcp-stdio-loader.mjs', import.meta.url);
const { POLARITY_IDS, newPolarity, intensifyPolarity } = await import('../lib/graph/lorecube/polarity.js');
const { polarityDiagram, reserveDiagram, holdMatrixDiagram, holdersDiagram } = await import('../lib/graph/lorecube/diagram.js');
const { renderSketchToSvg } = await import('../lib/sketch-svg.js');
const { newManual, intensifyManual } = await import('../lib/graph/lorecube/manual.js');
const { newTree, intensifyTree } = await import('../lib/graph/lorecube/tree.js');
const { manualDiagram, treeDiagram } = await import('../lib/graph/lorecube/diagram.js');

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'lorecube');
/** The reserves drawn: one a gauge carries whole, one split across meters, one with a spend no gauge carries. */
export const SAMPLE_RESERVES = Object.freeze({
  mana: { name: 'mana', spent: ['special'], refill: ['time', 'hit'], empty: ['refused'] },
  breath: { name: 'breath', spent: ['sustain', 'dodge', 'guard'], refill: ['time'], empty: ['winded'] },
  'inner-reserve': { name: 'inner reserve', spent: ['special', 'move', 'imbue'], refill: ['time'], empty: ['refused'] },
});

/** The holders drawn: four factions as party classes on a ring of elements (each difference their own), and two sides
 * of one energy as the hero and its foe (the differences a game has one of, said). */
export const SAMPLE_HOLDERS = Object.freeze({
  'four-classes': {
    title: 'four orders, each an element: as party classes',
    polarity: { shape: 'pairs', of: [['fire', 'water'], ['wind', 'earth']] },
    reserves: [{ name: 'mana', spent: ['skill'], refill: ['rest', 'item'], empty: ['refused'] }],
    holders: [['ember', 'the Ember Court', 'fire'], ['tide', 'the Tide Court', 'water'], ['gale', 'the Gale Court', 'wind'], ['stone', 'the Stone Court', 'earth']]
      .map(([id, name, element]) => ({ id, kind: 'class', name, slice: { element, reserve: 'mana' }, differs: ['element', 'powers', 'look', 'reserve'] })),
  },
  'two-sides': {
    title: 'one energy, two sides: the hero and its foe',
    polarity: 'two-poles',
    reserves: [{ name: 'the current', spent: ['special', 'imbue'], refill: ['hit'], empty: ['refused'] }],
    holders: [
      { id: 'warden', kind: 'hero', name: 'the Warden', slice: { element: 'light', reserve: 'the current' }, differs: ['element', 'powers', 'kit', 'timing', 'ui'] },
      { id: 'fallen', kind: 'foe', name: 'the Fallen', slice: { element: 'dark', reserve: 'the current' }, differs: ['element', 'powers', 'timing', 'look', 'ui'] },
    ],
  },
});

/** The manual drawn: a small bestiary on the three that chase each other round, taken to its numbered rung. */
export const SAMPLE_MANUAL = Object.freeze({
  name: 'the Thawing Marches',
  polarity: 'storm-three',
  creatures: [
    { id: 'cinder-imp', element: 'fire', role: 'grunt' }, { id: 'ash-hound', element: 'fire', role: 'harrier' }, { id: 'kiln-warden', element: 'fire', role: 'elite' },
    { id: 'rime-mite', element: 'ice', role: 'grunt' }, { id: 'frost-wight', element: 'ice', role: 'elite' }, { id: 'the-glacier-king', element: 'ice', role: 'boss', name: 'The Glacier King' },
    { id: 'spark-moth', element: 'lightning', role: 'harrier' }, { id: 'storm-crow', element: 'lightning', role: 'grunt' }, { id: 'thunder-ram', element: 'lightning', role: 'elite' },
  ],
});
/** The tree drawn: a school of fire, learned by rank down its spine and bought to either side. */
export const SAMPLE_TREE = Object.freeze({
  premise: { id: 'pyre', name: 'The Pyre School', element: 'fire', techniques: [
    { id: 'spark', does: 'bolt' }, { id: 'kindle', does: 'surge' }, { id: 'flame-edge', does: 'blade' }, { id: 'cauterise', does: 'mend' },
    { id: 'smoulder', does: 'hex', status: 'poison' }, { id: 'wildfire', does: 'storm' }, { id: 'ashen-veil', does: 'ward' }, { id: 'conflagration', does: 'storm' },
  ] },
  order: { spark: { at: 1 }, kindle: { at: 2 }, 'flame-edge': { at: 3 }, cauterise: { requires: [] }, smoulder: { requires: ['spark'] }, 'ashen-veil': { requires: ['cauterise'] }, wildfire: { requires: ['flame-edge', 'smoulder'] }, conflagration: { requires: ['wildfire'] } },
});

export async function drawings() {
  const out = [];
  // each named polarity as it stands after its intensification (its stock reasons laid on)
  for (const id of POLARITY_IDS) out.push([`polarity-${id}.svg`, polarityDiagram(intensifyPolarity(newPolarity(id)).polarity)]);
  for (const [id, R] of Object.entries(SAMPLE_RESERVES)) out.push([`reserve-${id}.svg`, reserveDiagram(R)]);
  out.push(['holders-what-each-can-own.svg', holdMatrixDiagram()]);
  out.push(['manual-thawing-marches.svg', manualDiagram(intensifyManual(newManual(SAMPLE_MANUAL), { affinity: true, levels: true }).manual)]);
  out.push(['tree-pyre-premise.svg', treeDiagram(newTree(SAMPLE_TREE.premise))]);
  out.push(['tree-pyre.svg', treeDiagram(intensifyTree(newTree(SAMPLE_TREE.premise), { order: SAMPLE_TREE.order, costs: true }).tree)]);
  for (const [id, S] of Object.entries(SAMPLE_HOLDERS)) out.push([`holders-${id}.svg`, holdersDiagram(S.holders, { polarity: S.polarity, reserves: S.reserves, title: S.title })]);
  return Promise.all(out.map(async ([name, manifest]) => [name, await renderSketchToSvg(manifest, { surface: 'light', backdrop: true })]));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check'), all = await drawings();
  let stale = 0;
  mkdirSync(OUT, { recursive: true });
  for (const [name, svg] of all) {
    const path = join(OUT, name);
    if (check) { if (!existsSync(path) || readFileSync(path, 'utf8') !== svg) { stale++; process.stderr.write(`${path} is stale: run node scripts/lorecube-diagrams.mjs\n`); } }
    else { writeFileSync(path, svg); process.stdout.write(`${path}\n`); }
  }
  process.exit(stale ? 1 : 0);
}
