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

  it('the everyday register turns the shell down: no grating band, no pad, no crane, no bracing; a rubber base and a slim pilaster', () => {
    const E = STAGE_KITS['bay-everyday'], g = buildStageGeometry(planStage({ ...SUITE, kit: 'bay-everyday' })), [, big] = g.bayRooms;
    expect(E.B.base.h).toBeLessThan(KIT.B.base.h);
    expect(E.B.pilaster.out).toBeLessThan(KIT.B.pilaster.out);
    expect(g.faces.filter((f) => f.group === 'stage:band').length).toBe(0);
    expect(big.pad).toBeUndefined();
    expect(big.braced).toBeUndefined();
    expect(big.crane).toBeUndefined();
    expect(big.walkways.length).toBe(1);
    expect(assembleStageScene({ ...SUITE, kit: 'bay-everyday' }, {}).bay.laws.filter((l) => !l.ok)).toEqual([]);
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

  it('the air: a duct in every tall roof, hung from it, a terminal each bay; a coffer\'s diffusers; a low room\'s and its return', () => {
    const n = Math.round(30 / KIT.bay);
    for (const roof of ['beams', 'truss', 'vault', 'sawtooth']) {
      const A = bare(roof).structure.air;
      expect(A.runs, roof).toBeGreaterThan(0);
      expect(A.hangers, roof).toBeGreaterThanOrEqual(A.runs * 2);
      // (one bay's terminal gives way to the crane's girder)
      expect(A.terminals, roof).toBeGreaterThanOrEqual(roof === 'sawtooth' ? (n - 1) * 2 : n - 1);
    }
    expect(bare('coffer').structure.air.terminals).toBeGreaterThan(0);
    const lo = bare('beams', { h: 3.5 }).structure.air;
    expect(lo.terminals).toBeGreaterThan(0);
    expect(lo.returns).toBeGreaterThanOrEqual(2);
    // (a tall room's outside end wall breathes through a weather louvre)
    expect(tall.air.louvre).toBe(true);
    // (a round duct in one register, a rectangular one in another: the catalog's)
    expect(new Set(BAY_REGISTERS.map((r) => STAGE_KITS[`bay-${r}`].B.air.duct.shape))).toEqual(new Set(['round', 'rect']));
  });

  it('colour: the secondary paint and light are the register\'s own; the hazard stripe lies flat or small', () => {
    expect(geom.seats.some((s) => s.fixture === 'cove' && s.color === KIT.B.light.cove.color)).toBe(true);
    const hz = inGroup('stage:hazard'), upright = hz.filter((f) => Math.abs(f.normal[2]) < 0.5);
    // (no door head and no whole girder striped: an upright stripe only as the edge of a thin band)
    const tallest = Math.max(0, ...upright.map((f) => Math.max(...f.corners.map((c) => c[2])) - Math.min(...f.corners.map((c) => c[2]))));
    expect(tallest).toBeLessThan(0.2);
  });

  it('services: boxes and panels on the walls, cables slung, and a low room\'s soffit one panel out over the plenum', () => {
    expect(tall.services).toBeGreaterThan(0);
    expect(low.openPanel).toBeDefined();
    for (const g of ['stage:cabinet', 'stage:cable', 'stage:plenum']) expect(inGroup(g).length, g).toBeGreaterThan(0);
  });

  it('read in the form render, its lamps go to the page; a lamp inset in the floor stays in the bake', () => {
    const P = assembleStageScene(SUITE, { formLit: true }), kinds = new Set(P.form.room.lights.map((l) => l.live));
    expect(kinds).toEqual(new Set([true, false]));
    expect(readFormLight([{ at: [0, 0, 0], radius: 2, fixture: 'inset' }], [[1, 1, 1]])[0].live).toBe(false);
  });
});

describe('glass', () => {
  it('windows only where a wall faces out: none in a wall another room stands against, the sun laid on the floor', () => {
    expect(tall.glass.windows).toBeGreaterThan(0);
    expect(low.glass.windows).toBeGreaterThan(0);
    // (the low room's far wall is the tall room's: no pane in it)
    const panes = geom.faces.filter((f) => ['stage:pane', 'stage:wired'].includes(f.group));
    expect(panes.filter((f) => f.corners.every((c) => Math.abs(c[1] - 12) < 0.6 && c[0] > 0 && c[0] < 6)).length).toBe(0);
    expect(tall.glass.patches).toBeGreaterThan(0);
    expect(inGroup('stage:sky').length).toBe(tall.glass.windows + low.glass.windows);
  });
  it('a tall room\'s booth: its panes clear glass, those a walker reaches banded, over a dado or not by register', () => {
    for (const reg of BAY_REGISTERS) {
      const b = buildStageGeometry(planStage({ ...SUITE, kit: `bay-${reg}` })).bayRooms[1].glass.booth;
      expect(b, reg).toBeTruthy();
      expect(b.unmarked, reg).toBe(0);
      if (!b.dado) expect(b.marked, reg).toBeGreaterThan(1);
    }
    expect(inGroup('stage:frit').length).toBeGreaterThan(0);
  });
  it('every pane is untinted (the bake leaves it) and carries the catalog\'s glass', () => {
    const look = KIT.B.glass.look;
    for (const f of inGroup('stage:pane')) { expect(f.tint).toBeUndefined(); expect(f.alpha).toBe(look.alpha); }
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
    // (the stair's banister rides its pitch: the infill starts over the treads, the floor under the flight left open)
    expect(Math.min(...infill.flatMap((f) => f.corners.map((c) => c[2])))).toBeGreaterThan(0);
  });
  it('the laws read it so, and every one holds on the suite', () => {
    const laws = assembleStageScene(SUITE, {}).bay.laws;
    expect(laws.map((l) => l.law)).toEqual(['layers', 'overhead', 'two-scales', 'walkway-entries', 'banisters-block', 'two-ways-in', 'glass-marked', 'accent']);
    expect(laws.filter((l) => !l.ok)).toEqual([]);
  });
});
