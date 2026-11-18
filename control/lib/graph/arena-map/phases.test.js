// THE MISSION'S PHASES ON A MAP (phases.js): one map, the smallest template chosen in code, grown for a kit of the near
// bands under the arena laws. The concepts: every phase stands where the map's own measures put it (the start a spawn,
// arm up a few steps off it, each clear's foes out of the sight of where it begins and at its band, the hold at the heart
// with its waves by more than one way, the way out a spawn); its laws hold on it; nothing seals; the same seed is the same
// mission and another is another; the map's own graph walks between any two places.
import { describe, expect, it } from 'vitest';
import { phasesOnMap, phaseLaws, mapRoute, nodeAt } from './phases.js';
import { growArenaMap } from './generate.js';
import { TEMPLATES, TEMPLATE_IDS } from './templates.js';
import { kitOf, furnish } from './laws.js';
import { indexMap, visibility, key, centre } from './map.js';
import { mapPoint } from './ground.js';
import { CELL } from './blocks.js';
import { BANDS } from '../mission/sections.js';

// a brief of the near bands, as mission/brief.js reads one for a kit of a rifle and a shotgun
const BRIEF = { guns: [{ name: 'rifle', band: 'mid' }, { name: 'shotgun', band: 'close' }], serves: { close: true, mid: true, long: false }, sections: ['staging', 'contact', 'lane', 'holdout', 'extract'], yard: 'mid', run: 4.6, eye: 1.7, scale: 1, hold: 40, waves: 3, map: null, why: {} };
const SMALLEST = TEMPLATE_IDS.reduce((a, b) => { const A = TEMPLATES[a].build(), B = TEMPLATES[b].build(); return A.nx * A.ny * A.nz <= B.nx * B.ny * B.nz ? a : b; });
const G = growArenaMap({ template: SMALLEST, seed: 1, kit: kitOf(BRIEF) });
const P = phasesOnMap(BRIEF, G.map, { seed: 1 });
const byKind = (k) => P.sections.filter((S) => S.task.kind === k);

describe('a mission\'s phases placed on a map', () => {
  it('is the composition the mission level consumes, on the map, with no doors', () => {
    expect(G.complete).toBe(true);
    expect(P.on).toBe('map');
    expect(P.sections.map((S) => S.id)).toEqual(BRIEF.sections);
    expect(P.sections.map((S) => S.task.kind)).toEqual(['take', 'clear', 'clear', 'hold', 'reach']);
    expect(P.sections.every((S) => S.door === null && S.zone === null && Array.isArray(S.foes) && Array.isArray(S.drops) && S.entry.length === 3)).toBe(true);
    expect(P.anchors.spawn).toEqual(mapPoint(P.cells.start));
    expect(P.anchors.exit).toEqual(byKind('reach')[0].task.at);
  });
  it('stands each phase where the map\'s measures put it', () => {
    const I = indexMap(G.map), V = visibility(I), F = furnish(I, V, kitOf(BRIEF)), spawns = F.spawns.map((c) => key(...c));
    expect(spawns).toContain(key(...P.cells.start));
    // arm up a few steps off the start, so it is walked to
    const arm = byKind('take')[0];
    expect(Math.hypot(arm.task.at[0] - P.anchors.spawn[0], arm.task.at[1] - P.anchors.spawn[1])).toBeGreaterThanOrEqual(CELL - 1e-6);
    // the hold at the heart: the first prize's place, among the most seen
    const hold = byKind('hold')[0], heart = V.index.get(key(...hold.cells.at)), rank = [...V.seenBy].sort((a, b) => b - a);
    expect(V.seenBy[heart]).toBeGreaterThanOrEqual(rank[Math.floor(V.n / 3)]);
    expect(hold.task.waves.length).toBe(BRIEF.waves);
    // each clear's foes out of sight of where it begins
    const n = V.n, sees = (a, b) => V.vis[V.index.get(key(...a)) * n + V.index.get(key(...b))] === 1;
    for (const S of byKind('clear')) for (const c of S.cells.foes) expect(sees(S.cells.from, c), `${S.id} ${c}`).toBe(false);
    // the way out a spawn
    expect(spawns).toContain(key(...byKind('reach')[0].cells.at));
  });
  it('holds its laws: placed, unseen, two ways, in order, banded', () => {
    const L = phaseLaws(P, G.map);
    expect(L.map((l) => l.law)).toEqual(['placed', 'unseen', 'two-ways', 'in-order', 'banded']);
    expect(L.filter((l) => !l.holds).map((l) => `${l.law}: ${l.says}`)).toEqual([]);
    // (advice, never a refusal: a mission out of order is said so)
    const bad = { ...P, sections: [...P.sections].reverse() };
    expect(phaseLaws(bad, G.map).find((l) => l.law === 'in-order')).toMatchObject({ holds: false });
    expect(BANDS.close.reach[1]).toBeGreaterThan(0);
  });
  it('is the same mission on the same seed, and another on another', () => {
    expect(phasesOnMap(BRIEF, G.map, { seed: 1 })).toEqual(P);
    const Q = phasesOnMap(BRIEF, G.map, { seed: 2 });
    expect(JSON.stringify(Q.sections.map((S) => S.cells))).not.toBe(JSON.stringify(P.sections.map((S) => S.cells)));
  });
  it('walks the map\'s own graph between two places, and knows the node a body stands on', () => {
    const I = indexMap(G.map), a = key(...P.cells.start), b = key(...P.cells.heart), R = mapRoute(I, a, b);
    expect(R[0]).toBe(a);
    expect(R[R.length - 1]).toBe(b);
    for (let i = 0; i + 1 < R.length; i++) expect(I.adj.get(R[i]).some((e) => e.to === R[i + 1])).toBe(true);
    const c = centre(P.cells.heart);
    expect(nodeAt(I, [c[0] + 0.4, c[1] - 0.4, c[2] + 1.6], 1.6)).toBe(b);
  });
});
