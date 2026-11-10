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
const { newBackdrop, intensifyBackdrop } = await import('../lib/graph/lorecube/backdrop.js');
const { backdropTimeline, backdropWeb, backdropMap } = await import('../lib/graph/lorecube/diagram.js');

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

/** The backdrop drawn: a small invented setting that has every kind of statement, taken to the author's choices. */
export const SAMPLE_BACKDROP = Object.freeze({
  premise: {
    title: 'The Drowned Valley',
    actors: [{ id: 'millers', name: 'the millers', kind: 'people' }, { id: 'lowlanders', name: 'the lowlanders', kind: 'people' }, { id: 'ferrymen', name: 'the ferrymen', kind: 'people' }, { id: 'river', name: 'the river', kind: 'force' }],
    events: [
      { n: 1, says: 'The river floods the low fields three years running', who: ['river'] },
      { n: 2, says: 'The millers dam it above the valley', who: ['millers'] },
      { n: 3, says: 'The valley drowns behind the dam; no one can stop the water', who: ['river'] },
      { n: 4, says: 'The lowlanders move up to the mill town', who: ['lowlanders'] },
      { n: 5, says: 'Ferries begin to cross the new lake', who: ['ferrymen'] },
      { n: 6, says: 'The millers raise the toll on power; the town goes dark two nights in three', who: ['millers', 'lowlanders'] },
    ],
  },
  passes: [
    { stretches: [{ id: 's1', handle: 'the floods and the dam', agency: 'acted' }, { id: 's2', handle: 'the drowning', agency: 'watched' }, { id: 's3', handle: 'the move and the toll', agency: 'acted' }], events: { 1: { stretch: 's1' }, 2: { stretch: 's1', from: [1] }, 3: { stretch: 's2', from: [2] }, 4: { stretch: 's3', from: [3] }, 5: { stretch: 's3' }, 6: { stretch: 's3', from: [2, 4] } } },
    { places: [{ id: 'dam', name: 'the dam', state: 'holds; the millers\' and no one else\'s', who: ['millers'] }, { id: 'lake', name: 'the lake', state: 'the valley, under water', who: ['ferrymen'] }, { id: 'town', name: 'the mill town', state: 'crowded since the move, dark most nights', who: ['millers', 'lowlanders'] }], moves: [{ from: 'dam', to: 'town', says: 'power, at a toll', basis: 'stated' }, { from: 'lake', to: 'town', says: 'people and goods by ferry', basis: 'inferred', because: 'ferries cross the lake' }], texture: ['the bells of the drowned church are heard in a dry summer'], events: { 2: { at: ['dam'] }, 3: { at: ['lake'] }, 4: { at: ['town'] }, 5: { at: ['lake'] }, 6: { at: ['dam', 'town'] } } },
    { wants: [{ who: 'millers', wants: 'the dam and its toll kept', over: 'the dam', basis: 'stated' }, { who: 'lowlanders', wants: 'light, and their valley back', over: 'the dam', basis: 'inferred', because: 'they lost the valley and sit in the dark' }], conflicts: [{ id: 'the-floods', between: ['millers', 'river'], over: 'the floods', state: 'resolved', basis: 'stated', stretch: 's1' }, { id: 'the-toll', between: ['millers', 'lowlanders'], over: 'the price of power', state: 'open', basis: 'stated', stretch: 's3' }], threads: ['the drowned church'], unknowns: ['how long ago the valley drowned', 'whose side the ferrymen are on'] },
    { play: { begins: { after: 6 }, pov: { who: 'a ferryman' }, route: [{ place: 'town', shows: [4, 6] }, { place: 'lake', shows: [3, 5] }, { place: 'dam', shows: [2] }], basis: 'stated' } },
  ],
});
export const sampleBackdrop = () => SAMPLE_BACKDROP.passes.reduce((B, add) => intensifyBackdrop(B, add).backdrop, newBackdrop(SAMPLE_BACKDROP.premise));

export async function drawings() {
  const out = [];
  // each named polarity as it stands after its intensification (its stock reasons laid on)
  for (const id of POLARITY_IDS) out.push([`polarity-${id}.svg`, polarityDiagram(intensifyPolarity(newPolarity(id)).polarity)]);
  for (const [id, R] of Object.entries(SAMPLE_RESERVES)) out.push([`reserve-${id}.svg`, reserveDiagram(R)]);
  out.push(['holders-what-each-can-own.svg', holdMatrixDiagram()]);
  out.push(['backdrop-timeline.svg', backdropTimeline(sampleBackdrop())], ['backdrop-web.svg', backdropWeb(sampleBackdrop())], ['backdrop-map.svg', backdropMap(sampleBackdrop())]);
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
