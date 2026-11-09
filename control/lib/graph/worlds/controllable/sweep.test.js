// sweep.js — a hit from a swing: a blade's segment, or a fist's point, swept from last frame's place to this frame's,
// strikes the first hittable body its paths meet, moving at the swing's floor, once a pass; the cut's direction is read
// in the striker's view; the bus hears it; a step without sweeps does nothing.
import { describe, expect, it } from 'vitest';
import { composeLive } from './compose.js';

const K = composeLive();
const DT = 1 / 60, FLAT = { ground: () => 0 };
const striker = (over = {}) => ({ id: 'p', rule: { type: 'platform', eye: 0, speed: 4, ...over }, transform: { pos: [0, 0, 0], heading: 0 } });
const dummy = (id, at, over = {}) => ({ id, rule: { type: 'clock' }, body: { type: 'box', hittable: true, hp: 100, egg: { a: 0.3, c: 0.9, cz: 0.9 } }, transform: { pos: at, heading: Math.PI }, ...over });
const world = (...others) => K.createWorld({ entities: [striker(), ...others] });
// a blade 0.8 m long held out along +X at height z, its guard at x = 0.4, swept along y at `y`
const blade = (y, z = 1.2) => ({ id: 'R', kind: 'blade', a: [0.4, y, z], b: [1.2, y, z], r: 0.03 });
const step = (w, hands) => K.stepWorld(w, { sweeps: { by: 'p', hands } }, DT, FLAT);
/** a horizontal slash: the blade swept from y0 to y1 over n frames */
const slash = (w, y0, y1, n = 6, z) => { for (let i = 0; i <= n; i++) step(w, [blade(y0 + ((y1 - y0) * i) / n, z)]); };

describe('a hit from a swing', () => {
  it('a blade swept through a body strikes it once: the hit, the damage, the spark, the cut to the right', () => {
    const w = world(dummy('d', [0.9, 0, 0]));
    slash(w, 0.6, -0.6);   // across the body, left to right in the striker's view (+X: its right is −Y)
    const d = w.byId.d;
    expect(d.hits).toBe(1);
    expect(d.body.hp).toBe(90);
    expect(d.lastHitBy).toBe('p');
    expect(d.lastCut.dir).toBe('right');
    expect(d.lastCut.kind).toBe('blade');
    expect(w.clashes.length).toBe(1);
    expect(w.byId.p.lastSweep.target).toBe('d');
  });

  it('a downward cut reads down; a slow one strikes nothing; one held still in a body strikes nothing', () => {
    const w = world(dummy('d', [0.9, 0, 0]));
    for (let i = 0; i <= 6; i++) step(w, [{ id: 'R', kind: 'blade', a: [0.9, 0, 2.4 - 0.25 * i], b: [0.9, 0.0001, 2.0 - 0.25 * i], r: 0.03 }]);
    expect(w.byId.d.lastCut.dir).toBe('down');
    const slow = world(dummy('d', [0.9, 0, 0]));
    slash(slow, 0.6, -0.6, 120);   // 1.2 m in two seconds: 0.6 m/s, under the floor
    expect(slow.byId.d.hits || 0).toBe(0);
    const still = world(dummy('d', [0.9, 0, 0]));
    for (let i = 0; i < 30; i++) step(still, [blade(0)]);
    expect(still.byId.d.hits || 0).toBe(0);
  });

  it('a pass strikes once; the same hand strikes again after `every`', () => {
    const w = world(dummy('d', [0.9, 0, 0]));
    slash(w, 0.6, -0.6); slash(w, -0.6, 0.6, 6);   // straight back through within a fifth of a second
    expect(w.byId.d.hits).toBe(1);
    for (let i = 0; i < 30; i++) step(w, [blade(0.6)]);   // half a second at rest outside it
    slash(w, 0.6, -0.6);
    expect(w.byId.d.hits).toBe(2);
  });

  it('a fist is a point: a punch lands with its knuckles; the rule’s sweep tunes the blow', () => {
    const w = K.createWorld({ entities: [striker({ sweep: { damage: 25 } }), dummy('d', [0.9, 0, 0])] });
    for (let i = 0; i <= 6; i++) { const x = 0.1 + 0.12 * i; step(w, [{ id: 'L', kind: 'fist', a: [x, 0, 1.3], b: [x, 0, 1.3], r: 0.045 }]); }
    expect(w.byId.d.hits).toBe(1);
    expect(w.byId.d.body.hp).toBe(75);
    expect(w.byId.d.lastCut.hand).toBe('L');
  });

  it('the first body in the way is struck; an ally and the downed are passed through', () => {
    const w = K.createWorld({ entities: [{ ...striker(), team: 'a' }, dummy('ally', [0.9, 0.3, 0], { team: 'a' }), dummy('foe', [0.9, -0.3, 0], { team: 'b' })] });
    slash(w, 0.9, -0.9, 8);
    expect(w.byId.ally.hits || 0).toBe(0);
    expect(w.byId.foe.hits).toBe(1);
  });

  it('the bus hears the cut once, beside the hit', () => {
    const w = world(dummy('d', [0.9, 0, 0]));
    let prev = K.castFacts(w, null).prev;
    slash(w, 0.6, -0.6);
    const r = K.castFacts(w, prev), types = r.events.map((e) => e.type);
    expect(types).toContain('hit:d');
    expect(r.events.find((e) => e.type === 'cut')).toMatchObject({ entity: 'd', by: 'p', dir: 'right', kind: 'blade', hand: 'R' });
    expect(types).toContain('cut:d');
    expect(K.castFacts(w, r.prev).events.filter((e) => e.type === 'cut')).toHaveLength(0);
  });

  it('a step without sweeps does nothing, and the striker’s first frame only marks where the hand is', () => {
    const w = world(dummy('d', [0.9, 0, 0]));
    for (let i = 0; i < 10; i++) K.stepWorld(w, {}, DT, FLAT);
    expect(w.byId.d.hits || 0).toBe(0);
    step(w, [blade(0)]);   // appears inside the body: no path yet
    expect(w.byId.d.hits || 0).toBe(0);
  });
});
