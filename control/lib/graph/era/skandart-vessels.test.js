// Skandart's vessels (skandart-vessels.js): what a room kept and left, standing in groups in a share of its bays, tipped
// and broken the further the room is gone; each standing or tipped one a thing a game that lets objects break breaks.
// One small ashlar crypt holds the concept (its card keeps urns, pots and jars), worn and ruined.
import { describe, it, expect } from 'vitest';
import { readVessels, VESSELS, CLASS_OF, vesselLook } from './skandart-vessels.js';
import { STAGE_KITS } from './stage.js';
import { assembleStageScene } from './stage.js';
import { breakablesOf } from '../playscape/destruct/breakability.js';

const ROOM = (over = {}) => ({ kind: 'stage', kit: 'gothic-ashlar', rooms: [{ id: 'a', x: 0, y: 0, w: 12, d: 16, h: 9 }], ...over });
const mine = (P) => P.anchors.filter((a) => /-sk-/.test(a.id));
const box = (P, id) => P.anchors.find((a) => a.id === id).box;

describe('a room\'s vessels', () => {
  it('stand in groups against its walls, each a thing of its own that breaks under any game that lets objects break', () => {
    const P = assembleStageScene(ROOM({ condition: 'worn' }), {});
    expect(P.skandart.vessels).toMatchObject({ laws: [] });
    const V = mine(P);
    expect(V.length).toBeGreaterThan(2);
    for (const a of V) { expect(Object.values(CLASS_OF)).toContain(a.form); expect(a.solid).toBe(true); expect(box(P, a.id).min[2]).toBeGreaterThan(-0.03); }
    const B = breakablesOf(P, 'objects');
    expect(B.breakables.filter((b) => /-sk-/.test(b.id)).map((b) => b.id).sort()).toEqual(V.map((a) => a.id).sort());
    expect(B.skipped.filter((q) => /-sk-/.test(q.id))).toEqual([]);
    // (a tipped one lies on its side: lower than it stands tall)
    const tall = (a) => box(P, a.id).max[2] - box(P, a.id).min[2], up = V.filter((a) => !a.tipped && a.vessel === 'urn'), down = V.filter((a) => a.tipped && a.vessel === 'urn');
    if (up.length && down.length) expect(Math.max(...down.map(tall))).toBeLessThan(Math.min(...up.map(tall)));
  }, 120_000);

  it('are left the further gone the more tipped and broken; a recipe that keeps none lays none; a bad word teaches the kinds', () => {
    const worn = assembleStageScene(ROOM({ condition: 'worn' }), {}).skandart.vessels, ruined = assembleStageScene(ROOM({ condition: 'ruined' }), {}).skandart.vessels;
    expect(ruined.broken).toBeGreaterThan(worn.broken);
    expect(ruined.standing).toBeLessThan(worn.standing);
    const none = assembleStageScene(ROOM({ skandart: { amount: 0.6, vessels: false } }), {});
    expect(mine(none)).toEqual([]);
    expect(none.skandart.vessels).toBeUndefined();
    expect(() => readVessels({ kinds: { teapot: 1 } })).toThrow(new RegExp(VESSELS.roles.join(', ')));
    expect(() => readVessels({ kinds: { crate: 1 }, look: 'baroque' })).toThrow(/old, industrial, clean/);
    expect(readVessels({ kinds: { crate: 2 } })).toEqual({ kinds: { crate: 2 }, every: VESSELS.every });
  }, 120_000);

  it('keeps a warehouse\'s wooden things: crates, some stacked (the top resting on the one under it, no bigger), barrels, kegs and chests, all breakable', () => {
    const P = assembleStageScene({ kind: 'stage', kit: 'bay-military', rooms: [{ id: 'a', x: 0, y: 0, w: 16, d: 20, h: 8 }], skandart: 0.3, _program: { use: 'warehouse' } }, {});
    expect(P.skandart.vessels).toMatchObject({ laws: [] });
    const V = mine(P), kinds = new Set(V.map((a) => a.vessel));
    expect([...kinds].every((k) => ['crate', 'barrel', 'keg', 'chest'].includes(k))).toBe(true);
    const tops = V.filter((a) => a.on);
    expect(tops.length).toBeGreaterThan(0);
    for (const t of tops) {
      const T = box(P, t.id), B = box(P, t.on);
      expect(Math.abs(T.min[2] - B.max[2])).toBeLessThan(0.005);
      expect(T.max[0] - T.min[0] + (T.max[1] - T.min[1])).toBeLessThanOrEqual(B.max[0] - B.min[0] + (B.max[1] - B.min[1]) + 1e-6);
    }
    const B = breakablesOf(P, 'objects');
    expect(B.breakables.filter((b) => /-sk-/.test(b.id))).toHaveLength(V.length);
    expect(B.skipped.filter((q) => /-sk-/.test(q.id))).toEqual([]);
  }, 120_000);

  it('takes the look of the room it stands in: a crypt\'s wood and clay, a military bay\'s steel, a lab\'s plastic; flat colours, no grain', () => {
    expect(vesselLook(STAGE_KITS['gothic-ashlar'])).toBe('old');
    expect(vesselLook(STAGE_KITS['bay-military'])).toBe('industrial');
    expect(vesselLook(STAGE_KITS['research-lab'])).toBe('clean');
    expect(vesselLook(STAGE_KITS['gothic-ashlar'], { look: 'industrial' })).toBe('industrial');
    const base = (P) => P.faces.filter((f) => /^stage:prop/.test(f.group) && f.node && /-sk-/.test(f.node));
    const steel = assembleStageScene({ kind: 'stage', kit: 'bay-military', rooms: [{ id: 'a', x: 0, y: 0, w: 16, d: 20, h: 8 }], skandart: 0.3, _program: { use: 'warehouse' } }, {});
    expect(steel.skandart.vessels.look).toBe('industrial');
    const V = mine(steel);
    expect(V.every((a) => ['steel-crate', 'drum', 'footlocker'].includes(a.shape) && a.matter === 'sheet-metal')).toBe(true);
    const B = breakablesOf(steel, 'physical');
    expect(B.breakables.filter((b) => /-sk-/.test(b.id)).every((b) => b.matter === 'sheet-metal')).toBe(true);
    // (no texture on a vessel: its shape and its colour)
    expect(base(steel).every((f) => !f.texture)).toBe(true);
    expect(base(assembleStageScene(ROOM({ condition: 'worn' }), {})).every((f) => !f.texture)).toBe(true);
  }, 120_000);
});
