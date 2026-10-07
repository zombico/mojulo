import { describe, it, expect } from 'vitest';
import { IKEBANA_ROLES, IKEBANA_STYLES, IKEBANA_MATERIALS, IKEBANA_LAWS, clustersprout, ikebanaZone, ikebanaLaws, crownXY } from './out-ikebana.js';
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
    for (const M of Object.values(IKEBANA_MATERIALS)) for (const list of Object.values(M)) for (const m of list) expect(FLORA_FORMS[m.form].variants[m.variant], `${m.form} ${m.variant}`).toBeTruthy();
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
    for (const A of Z.arrangements) { expect(Math.abs(A.facing)).toBeLessThan(0.3); expect(A.laws).toEqual([]); }
    for (let i = 1; i < Z.arrangements.length; i++) expect(Z.arrangements[i].hand).not.toBe(Z.arrangements[i - 1].hand);
    expect(Z.arrangements.filter((A) => A.odd)).toHaveLength(1);
  });
  it('roles, styles and laws are stated', () => {
    expect(Object.keys(IKEBANA_ROLES)).toEqual(['shin', 'soe', 'hikae', 'jushi', 'ne']);
    expect(IKEBANA_LAWS.map((l) => l.id)).toEqual(['scalene', 'odd', 'ma', 'one-root', 'under', 'stands']);
    expect(ikebanaLaws(clustersprout(2))).toEqual([]);
    expect(designFlora('broccoli', 'bush', 1, { level: 'near', over: { blooms: 10 } }).faces.filter((f) => f.part === 'bloom').length).toBeGreaterThan(0);
  });
});
