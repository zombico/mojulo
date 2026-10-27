// The BAY shell (bay.js) and its kits (style/bay-kits.js): a modern room whose structure is its ornament. One register
// stands for all (they differ in data, not in procedure); a low room and a tall one stand for the shell's two roofs.
import { describe, expect, it } from 'vitest';
import { planStage, buildStageGeometry, STAGE_KITS, assembleStageScene } from './stage.js';
import { BAY_REGISTERS } from './style/bay-kits.js';
import { readFormLight } from '../form/room-form.js';

const SUITE = { kind: 'stage', kit: 'bay-military', rooms: [{ id: 'low', x: 0, y: 0, w: 6, d: 12, h: 3.5 }, { id: 'tall', x: -6, y: 12, w: 18, d: 30, h: 12 }], links: [{ from: 'low', to: 'tall' }] };
const geom = buildStageGeometry(planStage(SUITE)), [low, tall] = geom.bayRooms;
const inGroup = (g) => geom.faces.filter((f) => f.group === g);

describe('the bay kits', () => {
  it('every register is a room kit on the bay shell, its light the lab look\'s, no torch seated', () => {
    for (const reg of BAY_REGISTERS) expect(STAGE_KITS[`bay-${reg}`]).toMatchObject({ shell: 'bay', reference: 'lab-dark' });
    expect(geom.seats.every((s) => ['strip', 'highbay', 'inset', 'lamp'].includes(s.fixture))).toBe(true);
    expect(planStage(SUITE).refId).toBe(planStage({ ...SUITE, reference: 'lab-dark' }).refId);
  });
});

describe('the bay shell', () => {
  it('rhythm: the tall room\'s beams stand on its bay lines, a lamp hung between each pair, a strip on each pilaster', () => {
    // (the room as planned: inset half a wall from the recipe's lines)
    const bay = STAGE_KITS['bay-military'].bay, R = tall.r, run = R.y1 - R.y0, n = Math.round(run / bay);
    tall.beams.forEach((c, k) => expect(c).toBeCloseTo(R.y0 + (run * (k + 1)) / n, 6));
    expect(tall.beams.length).toBe(n - 1);
    expect(tall.lamps.length).toBe(n * 2);
    expect(geom.seats.filter((s) => s.fixture === 'strip').length).toBeGreaterThan(6);
  });

  it('layers: every solid wall a base, a field, a crown and what is over it', () => {
    for (const L of [...low.layers, ...tall.layers]) expect(L.bands, L.side).toBeGreaterThanOrEqual(3);
    for (const g of ['stage:base', 'stage:wall', 'stage:crown', 'stage:column']) expect(inGroup(g).length, g).toBeGreaterThan(0);
  });

  it('the floor is the map: a field, a band of grating at the walls\' feet, a hazard line, a pad in a big room', () => {
    expect(inGroup('stage:band').length).toBeGreaterThan(0);
    expect(inGroup('stage:hazard').length).toBeGreaterThan(0);
    expect(tall.pad).toBeDefined();
    expect(low.pad).toBeUndefined();
  });

  it('something hangs: the tall room\'s crane and catwalk, the low room\'s pipes and strips', () => {
    expect(tall.crane.hook[2]).toBeGreaterThan(3);
    expect(tall.catwalk).toMatchObject({ z: 4.2 });
    expect(low.tall).toBe(false);
    expect(low.pipes).toBe(2);
    expect(low.crane).toBeUndefined();
  });

  it('read in the form render, its lamps go to the page; a lamp inset in the floor stays in the bake', () => {
    const P = assembleStageScene(SUITE, { formLit: true }), kinds = new Set(P.form.room.lights.map((l) => l.live));
    expect(kinds).toEqual(new Set([true, false]));
    expect(readFormLight([{ at: [0, 0, 0], radius: 2, fixture: 'inset' }], [[1, 1, 1]])[0].live).toBe(false);
  });
});
