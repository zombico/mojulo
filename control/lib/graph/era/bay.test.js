// The BAY shell (bay.js) and its kits (style/bay-kits.js): a modern room whose structure is its ornament. One register
// stands for all (they differ in data, not in procedure); each roof system is built once on a bare room through the
// shell itself; the walkway's rules on the one tall room a suite holds.
import { describe, expect, it } from 'vitest';
import { planStage, buildStageGeometry, STAGE_KITS, assembleStageScene } from './stage.js';
import { bayRoom } from './bay.js';
import { BAY_REGISTERS } from './style/bay-kits.js';
import { readFormLight } from '../form/room-form.js';

const SUITE = { kind: 'stage', kit: 'bay-military', rooms: [{ id: 'low', x: 0, y: 0, w: 6, d: 12, h: 3.5 }, { id: 'tall', x: -6, y: 12, w: 18, d: 30, h: 12 }], links: [{ from: 'low', to: 'tall' }] };
const geom = buildStageGeometry(planStage(SUITE)), [low, tall] = geom.bayRooms;
const inGroup = (g) => geom.faces.filter((f) => f.group === g);
const KIT = STAGE_KITS['bay-military'];
// a bare room through the shell, its roof the one asked: no doorway, every surface a plain stub
const bare = (roof, { w = 18, d = 30, h = 12 } = {}) => {
  const out = [], kit = { ...KIT, B: { ...KIT.B, roofs: [roof] } }, surf = (part) => ({ key: part, scale: 1, tint: [1, 1, 1], group: `stage:${part}`, cell: 1 });
  const r = { id: 'r', x0: 0, y0: 0, x1: w, y1: d, h, open: [], openings: { '-y': [], '+x': [], '+y': [], '-x': [] } };
  return { out, ...bayRoom(out, r, 0, kit, surf) };
};

describe('the bay kits', () => {
  it('every register is a room kit on the bay shell, its light the lab look\'s, no torch seated', () => {
    for (const reg of BAY_REGISTERS) expect(STAGE_KITS[`bay-${reg}`]).toMatchObject({ shell: 'bay', reference: 'lab-dark' });
    expect(geom.seats.every((s) => ['strip', 'highbay', 'inset', 'lamp', 'cove', 'down', 'daylight'].includes(s.fixture))).toBe(true);
    expect(planStage(SUITE).refId).toBe(planStage({ ...SUITE, reference: 'lab-dark' }).refId);
  });

  it('a room takes its surfaces from the register\'s alternates by its dice: the same room the same, the offer kept', () => {
    for (const [part, took] of Object.entries(tall.surfaces)) expect(KIT.B.options[part]).toContain(took);
    expect(buildStageGeometry(planStage(SUITE)).bayRooms[1].surfaces).toEqual(tall.surfaces);
  });
});

describe('the bay shell', () => {
  it('layers: every solid wall a base, a field, a crown and what is over it', () => {
    for (const L of [...low.layers, ...tall.layers]) expect(L.bands, L.side).toBeGreaterThanOrEqual(3);
    for (const g of ['stage:base', 'stage:wall', 'stage:crown', 'stage:column', 'stage:paint']) expect(inGroup(g).length, g).toBeGreaterThan(0);
  });

  it('the floor is the map: a field, a band of grating at the walls\' feet, a hazard line, a pad in a big room', () => {
    expect(inGroup('stage:band').length).toBeGreaterThan(0);
    expect(tall.pad).toBeDefined();
    expect(low.pad).toBeUndefined();
  });

  it('the roof systems: each its members on the bay lines, lamps hung from it, a vault its gables, a sawtooth its daylight', () => {
    const beams = bare('beams'), truss = bare('truss'), vault = bare('vault'), saw = bare('sawtooth'), coffer = bare('coffer');
    const n = Math.round(30 / KIT.bay);
    for (const R of [beams, truss]) { expect(R.structure.beams.length).toBe(n - 1); expect(R.structure.lamps.length).toBe(n * 2); }
    // (a truss's web is diagonal: tubes whose ends differ in height and across the span)
    expect(truss.out.length).toBeGreaterThan(beams.out.length);
    expect(vault.structure.roof).toBe('vault');
    expect(Math.max(...vault.out.filter((f) => f.group === 'stage:wall').flatMap((f) => f.corners.map((c) => c[2])))).toBeCloseTo(12, 1);
    expect(saw.seats.filter((s) => s.fixture === 'daylight').length).toBe(n - 1);
    expect(coffer.structure.lamps.length).toBeGreaterThan(n);
    expect(bare('beams', { h: 3.5 }).structure.roof).toBe('soffit');
  });

  it('colour: the secondary paint and light are the register\'s own; the hazard stripe lies flat or small', () => {
    expect(geom.seats.some((s) => s.fixture === 'cove' && s.color === KIT.B.light.cove.color)).toBe(true);
    const hz = inGroup('stage:hazard'), upright = hz.filter((f) => Math.abs(f.normal[2]) < 0.5);
    // (no door head and no whole girder striped: an upright stripe only as the edge of a thin band)
    const tallest = Math.max(0, ...upright.map((f) => Math.max(...f.corners.map((c) => c[2])) - Math.min(...f.corners.map((c) => c[2]))));
    expect(tallest).toBeLessThan(0.2);
  });

  it('read in the form render, its lamps go to the page; a lamp inset in the floor stays in the bake', () => {
    const P = assembleStageScene(SUITE, { formLit: true }), kinds = new Set(P.form.room.lights.map((l) => l.live));
    expect(kinds).toEqual(new Set([true, false]));
    expect(readFormLight([{ at: [0, 0, 0], radius: 2, fixture: 'inset' }], [[1, 1, 1]])[0].live).toBe(false);
  });
});

describe('a walkway is entered, and its banisters block', () => {
  const W = tall.walkways[0], C = KIT.B.catwalk;
  it('a tall room\'s catwalk: entered by a stair at its near end, a long one by a second through a gap at its far end', () => {
    expect(W.z).toBe(C.z);
    expect(W.deck[1] - W.deck[0]).toBeGreaterThan(C.twoStairs);
    expect(W.entries.map((e) => e.at)).toEqual(['near', 'front']);
    for (const e of W.entries) { expect(e.width).toBeGreaterThanOrEqual(C.entry); expect(e.landing).toBeGreaterThanOrEqual(C.landing); }
  });
  it('railed over every drop but its entries, the infill covering the walk\'s rays from just over the deck to the top rail', () => {
    expect(W.railed).toEqual({ front: true, far: true, near: false });
    expect(W.infill[0]).toBeLessThanOrEqual(C.shin[0]);
    expect(W.infill[1]).toBeGreaterThanOrEqual(C.shin[1]);
    const infill = inGroup('stage:infill');
    expect(infill.length).toBeGreaterThan(0);
    // (the stair's skirt comes down to the floor: no one walks in under it)
    expect(Math.min(...infill.flatMap((f) => f.corners.map((c) => c[2])))).toBe(0);
  });
  it('the laws read it so, and every one holds on the suite', () => {
    const laws = assembleStageScene(SUITE, {}).bay.laws;
    expect(laws.map((l) => l.law)).toEqual(['layers', 'overhead', 'two-scales', 'walkway-entries', 'banisters-block', 'two-ways-in', 'accent']);
    expect(laws.filter((l) => !l.ok)).toEqual([]);
  });
});
