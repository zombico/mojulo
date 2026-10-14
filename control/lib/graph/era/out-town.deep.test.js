import { describe, it, expect } from 'vitest';
import { STRUCTURE_KITS, structureStyle } from './out-structures.js';
import { ANCHOR_IDS } from './out-anchor-structure.js';
import { BOUNDARY_ROLE_IDS, boundaryRoles } from './out-anchor-elements.js';
import { designTown, streetTile } from './out-town.js';
import { dressTown } from './out-town-dress.js';

// every town shape the card allows (open, fortified along the dial, and outside a castle), on anchors that between them
// take every walk form, boundary form and role fallback: the town's laws hold (and the fortified town's) (routes, lots,
// heartbeat, secondary, and the boundaries the plan makes room for), its dress keeps the walk clear, and every street
// tile at every rank, ring and kind tiles in whole units
const RECIPES = [{}, { branches: 0, levels: 0, back: false }, { branches: 1, levels: 1, sway: 1, heartbeat: 'burgh' }, { heartbeat: 'hamlet', farms: 1 }, { levels: 2, sway: 0.8, secondary: 1, heartbeat: 'market' },
  // the dial: walled, ditched, warded, the lord's land, with each composition and a seeded one
  { fortified: 0.3, fort: 'crenellated', branches: 0, levels: 0 }, { fortified: 0.5, fort: 'battered', sway: 1 }, { fortified: 0.7, fort: { seed: 7 }, heartbeat: 'burgh' }, { fortified: 1, fort: 'crenellated' }, { fortified: 1, fort: 'battered', heartbeat: 'market', secondary: 1 },
  // outside the castle: the lord's land drawn tight on the highest ground, each composition, one ward and two
  { castle: 'crenellated' }, { castle: { fort: 'battered', wards: 1, size: 48 }, levels: 2, heartbeat: 'burgh' }];

/** The street a language speaks, as the ways it builds: its walk form, its boundary forms, and how each role is taken. */
const streetWays = (L) => {
  const S = L.street, R = boundaryRoles(S.bounds, 3);
  return [`walk:${S.footway.form ?? 'kerbed'}`, ...Object.values(S.bounds ?? {}).map((b) => `bound:${b.form}`),
    ...BOUNDARY_ROLE_IDS.map((r) => `${r}:${!R[r] ? 'open' : R[r].id === 'default' ? 'default' : R[r].fell ? 'fell' : 'own'}`)];
};
// the authored anchors, then the seeded ones that take a way none before them took
const ANCHORS = (() => {
  const seen = new Set(), out = [];
  for (const anchor of [...ANCHOR_IDS, ...Array.from({ length: 24 }, (_, i) => ({ seed: i + 1 }))]) {
    const ways = streetWays(designTown(structureStyle(STRUCTURE_KITS[0], 1), 1, { anchor, branches: 0, levels: 0 }).language);
    if (typeof anchor === 'string' || ways.some((w) => !seen.has(w))) { out.push(anchor); ways.forEach((w) => seen.add(w)); }
  }
  return out;
})();

describe('out-town, swept', () => {
  it('holds every town law across anchors and shapes: each shape once, each anchor once at least', () => {
    const broken = [], n = Math.max(RECIPES.length, ANCHORS.length);
    for (let i = 0; i < n; i++) {
      const anchor = ANCHORS[i % ANCHORS.length], rec = RECIPES[i % RECIPES.length], k = STRUCTURE_KITS[i % 2], s = [3, 8][Math.floor(i / 2) % 2];
      const st = structureStyle(k, s), t = designTown(st, s, { ...rec, anchor }), id = `${JSON.stringify(anchor)} ${k} s${s} ${JSON.stringify(rec)}`;
      for (const l of [...t.laws, ...dressTown(t, st, 1, s).laws]) if (!l.ok) broken.push(`${id}: ${l.law} ${l.value}`);
    }
    expect(broken.slice(0, 20)).toEqual([]);
  });

  it('tiles every rank at every ring, for every anchor', () => {
    const broken = [];
    for (const anchor of ANCHORS) {
      const L = designTown(structureStyle(STRUCTURE_KITS[0], 1), 1, { anchor, branches: 0, levels: 0 }).language;
      for (const rank of ['lane', 'branch', 'upper', 'back']) for (const ring of ['near', 'mid', 'far']) for (const kind of ['run', 'drop', 'end']) for (const l of streetTile(L, rank, { ring, kind }).laws) if (!l.ok) broken.push(`${L.id} ${rank} ${ring} ${kind}: ${l.law} ${l.value}`);
    }
    expect(broken.slice(0, 20)).toEqual([]);
  });
});
