// THE GEAR (swing.js, the city stalker): the swinger's line to a face above and ahead, found for the hero; the swing
// under it, held to the line and clear of the street; the release that keeps its speed; no line where no face is in
// reach; the zip on the ground. Each law in a two-tower street, not a city.
import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld } from '../controllable-world.js';
import { emitThreeWorld } from '../../scene/scene-three.js';

const groundOf = (boxes) => ({ ground: (p) => boxes.reduce((g, b) => (p[0] >= b.min[0] && p[0] <= b.max[0] && p[1] >= b.min[1] && p[1] <= b.max[1] && b.max[2] <= p[2] + 1e-6 ? Math.max(g, b.max[2]) : g), 0) });
const hero = (rule = {}, pos = [5, 0, 12], heading = 0) => ({ id: 'hero', pilotable: true, rule: { type: 'platform', collideRadius: 0.35, collideHeight: 1.7, gear: 'swinger', ...rule }, transform: { pos, heading } });
const make = (boxes, h = hero()) => ({ w: createWorld({ entities: [h], colliders: boxes }), G: groundOf(boxes) });
const step = (W, input, n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) stepWorld(W.w, typeof input === 'function' ? input(i) : input, dt, W.G); return W.w.byId.hero; };
// a street along +x between two 80 m towers, its walls at y = ±6
const CANYON = [{ min: [0, 6, 0], max: [300, 14, 80] }, { min: [0, -14, 0], max: [300, -6, 80] }];
const hand = (h) => [h.transform.pos[0], h.transform.pos[1], h.transform.pos[2] + 1.7 * 0.9];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('the swinger: a line to a face above and ahead', () => {
  it('finds its anchor on a tower\'s face, above and ahead of the hero, without aiming', () => {
    const h = step(make(CANYON), { boost: 1 });
    expect(h.swinging).toBeTruthy();
    const a = h.swinging.anchor;
    expect(Math.abs(a[1])).toBeCloseTo(6, 6);
    expect(a[0]).toBeGreaterThan(h.transform.pos[0]);
    expect(a[2]).toBeGreaterThan(hand(h)[2]);
    expect(h.locomotion).toBe('swing');
  });

  it('swings under it: held to the line, clear of the street, carried on down the middle of the street', () => {
    const W = make(CANYON), h = step(W, { boost: 1 });
    const { pivot, L } = h.swinging, x0 = h.transform.pos[0];
    let low = Infinity;
    for (let i = 0; i < 90 && h.swinging; i++) {
      step(W, { boost: 1 });
      if (!h.swinging) break;
      expect(dist(hand(h), pivot)).toBeLessThanOrEqual(L + 1e-6);
      // the pivot drawn in toward the hero's line: the arc runs down the street, not into the wall the line is on
      expect(Math.abs(h.transform.pos[1])).toBeLessThan(2);
      low = Math.min(low, h.transform.pos[2]);
    }
    expect(low).toBeGreaterThan(1.5);
    expect(h.transform.pos[0]).toBeGreaterThan(x0 + 5);
  });

  it('lets go when the key is let go, flying on with the swing\'s speed across the ground', () => {
    const W = make(CANYON);
    step(W, { boost: 1 }, 50);
    const h = W.w.byId.hero, v = h.swinging.v;
    step(W, {});
    expect(h.swinging).toBeNull();
    expect(h.swung.end).toBe('release');
    expect(h.dashVel[0]).toBeCloseTo(v[0], 6);
    expect(Math.hypot(...h.dashVel)).toBeGreaterThan(5);
    step(W, {});
    expect(h.locomotion).toBe('swing_release');
  });

  it('casts no line where no face stands in reach, above and ahead, or onto a box marked hold: false', () => {
    const far = [{ min: [500, 6, 0], max: [520, 14, 80] }], low = [{ min: [0, 6, 0], max: [300, 14, 4] }], behind = [{ min: [-60, 6, 0], max: [0, 14, 80] }];
    for (const boxes of [[], far, low, behind, CANYON.map((b) => ({ ...b, hold: false }))]) {
      const h = step(make(boxes), { boost: 1 }, 5);
      expect(h.swinging || null, JSON.stringify(boxes)).toBeNull();
      expect(h.transform.pos[2]).toBeLessThan(12);
    }
    expect(step(make(CANYON, hero({ gear: undefined })), { boost: 1 }).swinging).toBeUndefined();
  });

  it('lets go when a box comes between the hand and the anchor', () => {
    const W = make(CANYON), h = step(W, { boost: 1 });
    const a = h.swinging.anchor, m = [(hand(h)[0] + a[0]) / 2, (hand(h)[1] + a[1]) / 2, (hand(h)[2] + a[2]) / 2];
    W.w.colliders.push({ min: [m[0] - 1, m[1] - 1, m[2] - 1], max: [m[0] + 1, m[1] + 1, m[2] + 1] });
    step(W, { boost: 1 });
    expect(h.swinging).toBeNull();
    expect(h.swung.end).toBe('cut');
  });

  it('zips on the ground: pulled straight to the face, where the wall takes hold', () => {
    const tower = [{ min: [20, -10, 0], max: [40, 10, 60] }];
    const W = make(tower, hero({ wall: true }, [0, 0, 0], 0));
    step(W, {}, 5);
    const h = step(W, (i) => ({ boost: i === 0 ? 1 : 0 }), 1);
    expect(h.zipping).toBeTruthy();
    step(W, {}, 120);
    expect(h.swung.end).toBe('zip');
    expect(h.walling).toMatchObject({ ax: 0, s: -1, at: 20 });
    expect(h.transform.pos[2]).toBeGreaterThan(5);
  });

  it('gains no energy unpumped: speed and height trade, they do not grow', () => {
    const W = make(CANYON), h = step(W, { boost: 1 });
    const energy = () => 0.5 * Math.hypot(...h.swinging.v) ** 2 + 20 * h.transform.pos[2];
    const e0 = energy();
    for (let i = 0; i < 80 && h.swinging; i++) { step(W, { boost: 1 }); if (h.swinging) expect(energy()).toBeLessThanOrEqual(e0 + 1e-6); }
  });

  it('is the same run for the same input', () => {
    const go = () => { const W = make(CANYON); step(W, (i) => ({ boost: i % 70 < 50 ? 1 : 0, turn: i % 40 < 20 ? 0.5 : -0.5, forward: 1 }), 400); return JSON.stringify(W.w.byId.hero.transform); };
    expect(go()).toBe(go());
  });

  it('is drawn on the page from the hand to the anchor, the line\'s code emitted only where a body has a gear', () => {
    const floor = { corners: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]], fill: '#445566', doubleSided: true };
    const page = (rule) => emitThreeWorld({ faces: [floor], entities: [{ id: 'hero', rule: { type: 'platform', ...rule }, body: { type: 'mesh', shape: 'box' } }], camera: { rule: 'follow', target: 'hero' } });
    expect(page({ gear: 'swinger' })).toContain('__updateGearLines();');
    expect(page({})).not.toContain('__updateGearLines');
  });
});

describe('the swinger\'s body: hung along its line, a somersault off it', () => {
  const lean = (h) => (h.tumble ? h.tumble.angle : 0);
  it('hangs along its line as it swings: leaning back toward a pivot ahead, eased in, about its own left', () => {
    const W = make(CANYON), h = step(W, { boost: 1 });
    expect(Math.abs(lean(h))).toBeLessThan(0.2);   // (eased in: no snap at the cast)
    step(W, { boost: 1 }, 20);
    const d = [hand(h)[0] - h.swinging.pivot[0], hand(h)[2] - h.swinging.pivot[2]];
    // behind and under the pivot the body's head is toward it: tipped forward, by `hang` of the line's own angle
    expect(lean(h)).toBeCloseTo(-Math.atan2(d[0], -d[1]) * 0.85, 2);
    // (about its own left: level, square to the way it faces)
    expect(h.tumble.axis[2]).toBe(0);
    expect(h.tumble.axis[0] * Math.cos(h.transform.heading) + h.tumble.axis[1] * Math.sin(h.transform.heading)).toBeCloseTo(0, 6);
    expect(-h.tumble.axis[0] * Math.sin(h.transform.heading) + h.tumble.axis[1] * Math.cos(h.transform.heading)).toBeCloseTo(1, 6);
  });

  it('let go high and fast, turns a somersault the way the swing carried it and opens upright; on the ground it stands', () => {
    const W = make(CANYON, hero({}, [5, 0, 40]));
    step(W, { boost: 1 }, 55);
    const h = W.w.byId.hero;
    expect(h.swinging).toBeTruthy();
    step(W, {});
    expect(h._gearTurn.flip.turns).toBe(1);
    let most = 0, played = false;
    for (let i = 0; i < 60 && h._gearTurn; i++) { step(W, {}); most = Math.max(most, Math.abs(lean(h))); played = played || h.locomotion === 'swing_release'; }
    expect(most).toBeGreaterThan(Math.PI);          // (past upside down: a whole turn)
    expect(played).toBe(true);
    expect(h._gearTurn).toBeNull();
    expect(h.tumble).toBeNull();
  });

  it('let go low, only rights itself; with hang and flips at 0 the body is never turned', () => {
    const W = make(CANYON, hero({}, [5, 0, 6]));
    step(W, { boost: 1 }, 30);
    const h = W.w.byId.hero;
    if (h.swinging) { step(W, {}); expect(h._gearTurn ? h._gearTurn.flip.turns : 0).toBe(0); }
    const P = make(CANYON, hero({ gear: { preset: 'swinger', hang: 0, flips: 0 } }, [5, 0, 40]));
    for (let i = 0; i < 80; i++) { step(P, { boost: i < 50 ? 1 : 0 }); expect(P.w.byId.hero.tumble ?? null).toBeNull(); }
  });
});
