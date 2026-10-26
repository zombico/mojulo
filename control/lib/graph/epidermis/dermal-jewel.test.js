// The piercings' concepts: each site lies on its own tissue (the lobe the ear's lowest, the nostril on the nose's wing,
// the septum under the nose on the middle), on the skin (the head's field there about zero), a hoop runs through its hole,
// the list reads words and refuses what a site does not take, the same head places the same jewellery, none adds nothing.
import { describe, it, expect } from 'vitest';
import { relationalHead } from '../polygonizer/head-relational.js';
import { relationalHeadChart, STAND_M } from './dermal-head.js';
import { pierce, readPiercings, PIERCING_SITES } from './dermal-jewel.js';

const head = relationalHead({ sex: 'female' }), chart = relationalHeadChart(head, { cells: 44 });
const L = head.landmarks, M = (p) => [p.x * STAND_M, p.y * STAND_M, p.z * STAND_M];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('piercings', () => {
  const all = Object.keys(PIERCING_SITES), J = pierce(chart, head, all);
  const at = (site, side) => J.pieces.find((p) => p.site === site && (!side || p.side === side));
  it('places each site on its tissue, on the skin', () => {
    expect(new Set(J.pieces.map((p) => p.site)).size).toBe(all.length);
    const lobe = at('lobe'), trag = M(L.tragionR);
    expect(lobe.at[2]).toBeLessThan(trag[2]);   // under the ear's canal
    expect(Math.abs(lobe.at[0])).toBeGreaterThan(Math.abs(trag[0]) * 0.9);
    expect(lobe.side === 'L' ? lobe.at[0] < 0 : lobe.at[0] > 0).toBe(true);
    expect(dist(at('nostril').at.map(Math.abs), M(L.alR))).toBeLessThan(0.008);
    const sep = at('septum'), sn = M(L.sn);
    expect(sep.at[0]).toBe(0); expect(Math.abs(sep.at[2] - sn[2])).toBeLessThan(0.004);
    for (const p of J.pieces) if (p.site !== 'septum') expect(Math.abs(head.field({ x: p.at[0] / STAND_M, y: p.at[1] / STAND_M, z: p.at[2] / STAND_M }) * STAND_M)).toBeLessThan(0.0008);
  });
  it('runs a hoop through its hole, and places the same jewellery on the same head', () => {
    const H = pierce(chart, head, [{ site: 'septum' }]), w = PIERCING_SITES.septum.wire, p = H.pieces[0].at;
    expect(Math.min(...H.mesh.vertices.map((v) => dist(v, p)))).toBeLessThan(w * 1.6);
    expect(pierce(chart, head, all)).toEqual(J);
  });
  it('reads words, refuses what a site does not take, and none adds nothing', () => {
    expect(readPiercings(['lobes']).map((p) => p.side)).toEqual(['L', 'R']);
    expect(readPiercings(['nostril-R'])[0]).toMatchObject({ site: 'nostril', side: 'R', kind: 'stud' });
    expect(() => readPiercings([{ site: 'septum', kind: 'stud' }])).toThrow(/takes/);
    expect(() => readPiercings(['navel'])).toThrow(/site/);
    expect(() => readPiercings([{ site: 'lobe', metal: 'tin' }])).toThrow(/metal/);
    const none = pierce(chart, head, undefined);
    expect(none.pieces).toEqual([]); expect(none.mesh.faces).toEqual([]);
  });
});
