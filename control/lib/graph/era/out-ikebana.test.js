import { describe, it, expect } from 'vitest';
import { IKEBANA_ROLES, IKEBANA_STYLES, IKEBANA_MATERIALS, IKEBANA_LAWS, WALK, clustersprout, ikebanaZone, ikebanaLaws, crownXY } from './out-ikebana.js';
import { FLORA_FORMS, floraMeasures, designFlora } from './out-flora.js';

describe('ikebana: clustersprout and the zone painter', () => {
  it('an arrangement is three principals in scalene steps, odd fillers, a root, from one kenzan, and keeps its laws', () => {
    const A = clustersprout(8, { materials: 'grove', scale: 9 });
    expect(A.laws).toEqual([]);
    const H = ['shin', 'soe', 'hikae'].map((r) => floraMeasures(A.stems.find((s) => s.role === r).design).height);
    expect(H[0] / H[1]).toBeGreaterThanOrEqual(1.2); expect(H[1] / H[2]).toBeGreaterThanOrEqual(1.2);
    expect(A.stems.length % 2).toBe(1);
    expect(A.stems.filter((s) => s.role === 'ne')).toHaveLength(1);
    for (const s of A.stems) expect(Math.hypot(s.x - A.at[0], s.y - A.at[1])).toBeLessThanOrEqual(A.kenzan + 1e-6);
    expect(JSON.stringify(A)).toBe(JSON.stringify(clustersprout(8, { materials: 'grove', scale: 9 })));
  });
  it('every material names doodads that exist, and the root of the grove is a bush in flower', () => {
    for (const M of Object.values(IKEBANA_MATERIALS)) for (const list of Object.values(M)) for (const m of [].concat(list)) expect(FLORA_FORMS[m.form].variants[m.variant], `${m.form} ${m.variant}`).toBeTruthy();
    const ne = clustersprout(3, { materials: 'grove', scale: 9, level: 'near' }).stems.find((s) => s.role === 'ne');
    expect(ne.variant).toBe('bush');
    expect(ne.design.faces.some((f) => f.part === 'bloom')).toBe(true);
  });
  it('the hand mirrors the arrangement about the viewer\'s line, and the ma stays open', () => {
    const L = clustersprout(5, { hand: 'left' }), R = clustersprout(5, { hand: 'right' });
    const side = (A) => Math.sign(crownXY(A.stems.find((s) => s.role === 'soe'))[0] - A.at[0]);
    expect(side(L)).toBe(-side(R));
    for (const A of [L, R]) expect(A.laws.filter((l) => l.law === 'ma')).toEqual([]);
  });
  it('a stem leans only as far as it stands, and a filler never spreads wider than soe', () => {
    const A = clustersprout(4, { style: 'slanting', bend: 1, materials: 'fungal', scale: 5 });
    for (const s of A.stems) expect(s.tilt).toBeLessThanOrEqual(IKEBANA_STYLES.slanting.lean[s.role] ?? 30);
    expect(A.laws.filter((l) => l.law === 'stands' || l.law === 'under')).toEqual([]);
  });
  it('the zone painter sprouts arrangements along strokes, turned to the trail, alternating hands, one odd per stroke', () => {
    const Z = ikebanaZone({ materials: 'grove', scale: 8, density: 0.7, strokes: [{ points: [[-9, 4], [-11, 22], [-8, 40]], width: 3 }], faceTo: [[0, 0], [0, 48]] }, 8);
    expect(Z.arrangements.length).toBeGreaterThan(2);
    for (const A of Z.arrangements) { expect(Math.abs(A.facing)).toBeLessThan(0.4); expect(A.laws).toEqual([]); }
    for (const A of Z.arrangements) for (const c of A.colliders.filter((k) => k.kind === 'block' && k.of !== 'ground')) expect(Math.abs(c.x) - c.r).toBeGreaterThanOrEqual(1.2 - 0.03);
    for (let i = 1; i < Z.arrangements.length; i++) expect(Z.arrangements[i].hand).not.toBe(Z.arrangements[i - 1].hand);
    expect(Z.arrangements.filter((A) => A.odd)).toHaveLength(1);
  });
  it('fillers mix: never the same thing twice running', () => {
    const A = clustersprout(6, { materials: 'garden', scale: 4.5, density: 1 }), J = A.stems.filter((s) => s.role === 'jushi');
    for (let i = 1; i < J.length; i++) expect(`${J[i].form}/${J[i].variant}`).not.toBe(`${J[i - 1].form}/${J[i - 1].variant}`);
    expect(new Set(A.stems.map((s) => `${s.form}/${s.variant}`)).size).toBeGreaterThanOrEqual(3);
  });
  it('a wide arrangement stands on its own ground with cover: a mound lifts it, a hollow holds a pool in the ma', () => {
    const G = clustersprout(3, { materials: 'garden', scale: 4.5 });
    expect(G.laws).toEqual([]);
    expect(G.ground.variant).toBe('mound');
    expect(G.stems.find((s) => s.role === 'shin').z).toBeGreaterThan(0);
    expect(G.cover.length).toBeGreaterThan(0);
    const O = clustersprout(3, { materials: 'oasis', scale: 5 });
    expect(O.laws).toEqual([]);
    const pool = O.colliders.find((c) => c.form === 'water');
    expect(pool.kind).toBe('wade');
    const toPool = Math.atan2(pool.y - O.at[1], pool.x - O.at[0]);
    expect(Math.abs(((toPool - O.facing + 3 * Math.PI) % (2 * Math.PI)) - Math.PI)).toBeLessThan(0.05);
  });
  it('walking: trunks and stones block, tufts are walked through, canopies walked under; a thicket blocks more', () => {
    const open = clustersprout(2, { materials: 'garden', scale: 4.5, density: 1, walk: 'open' }), thick = clustersprout(2, { materials: 'garden', scale: 4.5, density: 1, walk: 'thicket' });
    expect(open.colliders.filter((c) => c.form === 'tuft' && c.of === 'cover').every((c) => c.kind === 'walk')).toBe(true);
    expect(open.colliders.some((c) => c.form === 'stone' && c.kind === 'block')).toBe(true);
    expect(thick.colliders.filter((c) => c.kind === 'block').length).toBeGreaterThan(open.colliders.filter((c) => c.kind === 'block').length);
    expect(open.laws.filter((l) => l.law === 'way-in')).toEqual([]);
    expect(WALK.modes).toEqual(['open', 'thicket']);
  });
  it('roles, styles and laws are stated', () => {
    expect(Object.keys(IKEBANA_ROLES)).toEqual(['shin', 'soe', 'hikae', 'jushi', 'ne']);
    expect(IKEBANA_LAWS.map((l) => l.id)).toEqual(['scalene', 'odd', 'ma', 'one-root', 'under', 'stands', 'mix', 'way-in', 'trail-clear']);
    expect(ikebanaLaws(clustersprout(2))).toEqual([]);
    expect(designFlora('broccoli', 'bush', 1, { level: 'near', over: { blooms: 10 } }).faces.filter((f) => f.part === 'bloom').length).toBeGreaterThan(0);
  });
});
