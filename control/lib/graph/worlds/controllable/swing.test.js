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
    // (the line leaves the hand on the anchor's side, and the swing is that hand's)
    expect(h.locomotion).toBe(h.swinging.hand === 'L' ? 'swing_left' : 'swing');
    expect(h.swinging.hand).toBe(a[1] > 0 ? 'L' : 'R');
  });

  it('swings under it: held to the line, clear of the street, carried on down the middle of the street', () => {
    const W = make(CANYON), h = step(W, { boost: 1 });
    const { pivot, L } = h.swinging, x0 = h.transform.pos[0];
    let low = Infinity;
    for (let i = 0; i < 90 && h.swinging; i++) {
      step(W, { boost: 1 });
      if (!h.swinging) break;
      // (held within its stretch: an elastic line, taut at 22% over its length)
      expect(dist(hand(h), pivot)).toBeLessThanOrEqual(Math.max(h.swinging.L, h.swinging.most) + 1e-6);
      // the pivot drawn in toward the hero's line: the arc runs down the street, not into the wall the line is on
      expect(Math.abs(h.transform.pos[1])).toBeLessThan(2);
      low = Math.min(low, h.transform.pos[2]);
    }
    expect(low).toBeGreaterThan(1.5);
    expect(h.transform.pos[0]).toBeGreaterThan(x0 + 5);
  });

  it('lets go when the key is let go, flying on with the swing\'s speed across the ground', () => {
    // (the line that does not stretch: an elastic one adds its fling, below)
    const W = make(CANYON, hero({ gear: { preset: 'swinger', stretch: 0 } }));
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
    // (the line that does not stretch: an elastic one's recoil is the sling, and throws on purpose)
    const W = make(CANYON, hero({ gear: { preset: 'swinger', stretch: 0 } })), h = step(W, { boost: 1 });
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
    // (no room under it for a turn: `flipRoom` over anything this street has)
    const W = make(CANYON, hero({ gear: { preset: 'swinger', flipRoom: 500 } }, [5, 0, 12]));
    step(W, { boost: 1 }, 30);
    const h = W.w.byId.hero;
    expect(h.swinging).toBeTruthy();
    step(W, {});
    expect(h._gearTurn ? h._gearTurn.flip.turns : 0).toBe(0);
    const P = make(CANYON, hero({ gear: { preset: 'swinger', hang: 0, flips: 0 } }, [5, 0, 40]));
    for (let i = 0; i < 80; i++) { step(P, { boost: i < 50 ? 1 : 0 }); expect(P.w.byId.hero.tumble ?? null).toBeNull(); }
  });
});

describe('the swinger\'s line: elastic', () => {
  // one swing from 30 m over the street: cast, held to a little past the arc's low, let go
  const swing = (gear, at = 0.6) => {
    const W = make(CANYON, hero({ gear }, [5, 0, 30])), h = W.w.byId.hero;
    let most = 0, low = Infinity, on = 0;
    for (let i = 0; i < 600; i++) {
      const was = !!h.swinging;
      if (was) { most = Math.max(most, 1 + (h.swinging.ext || 0) / h.swinging.L); low = Math.min(low, h.transform.pos[2]); on = Math.hypot(...h.swinging.v); }
      step(W, { boost: !was || h.gaitPhase < at ? 1 : 0, forward: 1 });
      if (was && !h.swinging) return { most, low, on, off: Math.hypot(h.dashVel[0], h.dashVel[1], h.vel[2]), end: h.swung.end };
    }
    return null;
  };
  it('stretches past its length under the swing\'s load, never past its stretch, and stays clear of the street', () => {
    const E = swing('swinger');
    expect(E.end).toBe('release');
    expect(E.most).toBeGreaterThan(1.02);
    expect(E.most).toBeLessThanOrEqual(1.22 + 1e-6);
    expect(E.low).toBeGreaterThan(1.5);
    // a line cast low over the street is taut sooner: the body never meets the ground on it
    const W = make(CANYON, hero({}, [5, 0, 9])), h = W.w.byId.hero;
    for (let i = 0; i < 90; i++) { step(W, { boost: 1, forward: 1 }); if (h.swinging) expect(h.transform.pos[2]).toBeGreaterThan(1.5); }
  });
  it('throws the body: faster on the line than one that does not stretch, and flung faster still let go while it is stretched', () => {
    const E = swing('swinger'), R = swing({ preset: 'swinger', stretch: 0 }), N = swing({ preset: 'swinger', fling: 0 });
    expect(R.most).toBeLessThanOrEqual(1 + 1e-6);
    expect(R.off).toBeCloseTo(R.on, 6);
    expect(E.on).toBeGreaterThan(R.on);
    expect(N.off).toBeCloseTo(N.on, 6);
    expect(E.off).toBeGreaterThan(N.off);
    // never past the fling's own ceiling
    expect(E.off).toBeLessThanOrEqual(45 * 1.35 + 1e-6);
  });
});

describe('the gear: the point launch, the air zip, the dive', () => {
  // a 20 m block east of the hero, and a 200 m tower
  const BLOCK = [{ min: [8, -10, 0], max: [30, 10, 20] }], TALL = [{ min: [8, -10, 0], max: [30, 10, 200] }];
  // (stood on the street a few steps, then the key)
  const zipAt = (boxes, rule = {}) => { const W = make(boxes, hero(rule, [0, 0, 0])); step(W, {}, 4); step(W, { boost: 1 }); return W; };
  // open sky: one box far off, out of any line's reach
  const SKY = [{ min: [5000, 5000, 0], max: [5010, 5010, 10] }];

  it('a jump pressed on a zip carries it to the roof\'s edge and springs the body over it, turning', () => {
    const W = zipAt(BLOCK), h = W.w.byId.hero;
    expect(h.zipping).toBeTruthy();
    step(W, { jump: 1, jumpHeld: 1 });
    expect(h.zipping.over).toBe(true);
    expect(h.zipping.to[2]).toBeGreaterThan(20);
    for (let i = 0; i < 120 && h.zipping; i++) step(W, {});
    expect(h.swung).toMatchObject({ end: 'launch', over: true });
    expect(h.vel[2]).toBeGreaterThan(10);
    expect(h.dashVel[0]).toBeGreaterThan(10);          // on over the roof, east
    expect(h._gearTurn.flip.turns).toBe(1);
    for (let i = 0; i < 400 && !h.grounded; i++) step(W, {});
    // it lands on the roof, past its edge, upright
    for (let i = 0; i < 30; i++) step(W, {});
    expect(h.grounded).toBe(true);
    expect(h.transform.pos[2]).toBeCloseTo(20, 1);
    expect(h.transform.pos[0]).toBeGreaterThan(9);
    expect(h.tumble ?? null).toBeNull();
  });

  it('on a face too tall to top, the launch runs up the wall from where the zip lands; with no jump the zip holds the face', () => {
    const W = zipAt(TALL, { wall: true }), h = W.w.byId.hero;
    step(W, { jump: 1, jumpHeld: 1 });
    expect(h.zipping.over).toBeUndefined();
    for (let i = 0; i < 200 && h.zipping; i++) step(W, {});
    expect(h.swung.end).toBe('launch');
    expect(h.walling.run.up).toBeGreaterThan(20);
    const z = h.transform.pos[2];
    step(W, { forward: 1 }, 20);
    expect(h.locomotion).toBe('wall_run');
    expect(h.transform.pos[2]).toBeGreaterThan(z + 4);
    const P = zipAt(TALL, { wall: true }), p = P.w.byId.hero;
    for (let i = 0; i < 200 && p.zipping; i++) step(P, {});
    expect(p.swung.end).toBe('zip');
    expect(p.walling.run).toBeUndefined();
  });

  it('the key tapped twice in the air zips: a line let go as it is cast, then the key again', () => {
    const W = make(CANYON), h = W.w.byId.hero;
    step(W, { boost: 1 }, 3);
    expect(h.swinging).toBeTruthy();
    step(W, {}, 2);
    expect(h.swung.end).toBe('tap');
    expect(h._gearTurn ?? null).toBeNull();               // (a tap turns no somersault)
    step(W, { boost: 1 });
    expect(h.zipping).toBeTruthy();
    // held past the tap, a line let go is a release, and the key again casts a line, not a zip
    const S = make(CANYON), s = S.w.byId.hero;
    step(S, { boost: 1 }, 30); step(S, {}, 20); step(S, { boost: 1 }, 2);
    expect(s.zipping ?? null).toBeNull();
  });

  it('the dive: kneel held in the air falls harder and faster, head first, and a line cast out of it swings faster', () => {
    const fall = (kneel) => { const W = make(SKY, hero({}, [0, 0, 300])), h = W.w.byId.hero; step(W, { kneel }, 90); return h; };
    const D = fall(1), F = fall(0);
    expect(D.diving).toBeGreaterThan(1);
    expect(D.locomotion).toBe('dive');
    expect(D.transform.pos[2]).toBeLessThan(F.transform.pos[2] - 10);
    expect(D.tumble.angle).toBeCloseTo(1.2, 1);            // pitched forward, head first
    expect(F.diving).toBe(0);
    expect(F.tumble ?? null).toBeNull();
    // let go, the body rights itself
    const W = make(SKY, hero({}, [0, 0, 300])), h = W.w.byId.hero;
    step(W, { kneel: 1 }, 40); step(W, {}, 60);
    expect(h.diving).toBe(0);
    expect(h.tumble ?? null).toBeNull();
    // out of a dive into a swing: the fall's speed is the swing's
    const into = (kneel) => { const X = make(CANYON, hero({}, [5, 0, 70])), x = X.w.byId.hero; step(X, { kneel }, 45); step(X, { boost: 1 }, 2); return x.swinging ? Math.hypot(...x.swinging.v) : 0; };
    expect(into(1)).toBeGreaterThan(into(0) + 5);
  });
});

describe('the gear: the hand the line leaves', () => {
  it('is the one on the anchor\'s side of the body\'s way; dead ahead, the hand the last line did not leave', () => {
    // one tower to the north of a street running east: its face is on the hero's left
    const left = step(make([CANYON[0]]), { boost: 1 });
    expect(left.swinging.hand).toBe('L');
    expect(left.locomotion).toBe('swing_left');
    const right = step(make([CANYON[1]]), { boost: 1 });
    expect(right.swinging.hand).toBe('R');
    expect(right.locomotion).toBe('swing');
    // a beam dead ahead and overhead: the hands take turns
    const BEAM = [{ min: [10, -40, 30], max: [400, 40, 32] }], W = make(BEAM, hero({}, [5, 0, 12])), h = W.w.byId.hero, hands = [];
    for (let i = 0; i < 400 && hands.length < 4; i++) {
      const was = !!h.swinging;
      step(W, { boost: i % 40 < 28 ? 1 : 0, forward: 1 });
      if (h.swinging && !was) hands.push(h.swinging.hand);
    }
    expect(hands.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < hands.length; i++) expect(hands[i]).not.toBe(hands[i - 1]);
  });
});
