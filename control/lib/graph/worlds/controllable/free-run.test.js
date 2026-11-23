import { describe, expect, it } from 'vitest';
import { composeLive, emissionSource } from './compose.js';

// GETTING OVER THINGS (free-run.js): a body running at a low box goes over it; the jump at a taller one climbs it.

const E = composeLive();
const hooks = (boxes) => ({ ground: (p) => { let g = 0; for (const b of boxes) if (p[0] >= b.min[0] && p[0] <= b.max[0] && p[1] >= b.min[1] && p[1] <= b.max[1] && b.max[2] <= p[2] + 1e-6) g = Math.max(g, b.max[2]); return g; } });
const box = (x0, x1, h, y = 3) => ({ min: [x0, -y, 0], max: [x1, y, h] });
const world = (boxes, freeRun = {}) => E.createWorld({
  colliders: boxes,
  camera: { rule: 'follow', target: 'p' },
  entities: [{ id: 'p', pilotable: true, rule: { type: 'platform', speed: 5, eye: 0, collideRadius: 0.3, collideHeight: 1.7, ...(freeRun ? { freeRun } : {}) }, body: { type: 'mesh' }, transform: { pos: [0, 0, 0], heading: 0 } }],
});
const run = (w, boxes, input, n) => { const H = hooks(boxes); let top = 0; for (let k = 0; k < n; k++) { E.stepWorld(w, input, 1 / 60, H); top = Math.max(top, w.byId.p.transform.pos[2]); } return top; };

describe('getting over things', () => {
  it('is emitted only into a world that asks for it', () => {
    expect(emissionSource({})).not.toContain('stepWithFreeRun');
    expect(emissionSource({ freeRun: true })).toContain('stepWithFreeRun');
  });
  it('a low wall stops a body without it, and is gone over out of the run by one with it, landing on the ground beyond', () => {
    const B = [box(4, 4.5, 1)];
    const a = world(B, null); run(a, B, { forward: 1 }, 240);
    expect(a.byId.p.transform.pos[0]).toBeLessThan(4);
    const b = world(B), top = run(b, B, { forward: 1 }, 240);
    expect(b.byId.p.transform.pos[0]).toBeGreaterThan(5);
    expect(top).toBeGreaterThan(1);
    expect(b.byId.p.transform.pos[2]).toBeCloseTo(0, 2);
    expect(b.byId.p.fr).toBeNull();
  });
  it('the page is told the move: vault, its share done rising to the end', () => {
    const B = [box(4, 4.5, 1)], w = world(B), H = hooks(B), seen = [];
    for (let k = 0; k < 240; k++) { E.stepWorld(w, { forward: 1 }, 1 / 60, H); if (w.byId.p.fr) seen.push([w.byId.p.locomotion, w.byId.p.gaitPhase]); }
    expect(seen.length).toBeGreaterThan(10);
    expect(seen.every(([l]) => l === 'vault')).toBe(true);
    expect(seen.every(([, ph], i) => i === 0 || ph >= seen[i - 1][1])).toBe(true);
  });
  it('a wall over the hip is not vaulted; the jump at it climbs onto its top', () => {
    const thin = [box(4, 4.5, 1.9)];
    const a = world(thin); run(a, thin, { forward: 1 }, 240);
    expect(a.byId.p.transform.pos[0]).toBeLessThan(4);
    run(a, thin, { forward: 1, jump: 1 }, 2); run(a, thin, {}, 240);
    expect(a.byId.p.transform.pos[2]).toBeCloseTo(1.9, 1);          // onto its top, thin as it is
    const deep = [box(4, 8, 1.9)], b = world(deep);
    run(b, deep, { forward: 1 }, 240); run(b, deep, { forward: 1, jump: 1 }, 2); run(b, deep, {}, 120);
    expect(b.byId.p.transform.pos[2]).toBeCloseTo(1.9, 1);
    expect(b.byId.p.transform.pos[0]).toBeGreaterThan(4);
  });
  it('refused where another box stands at the landing, and over the tallest it climbs', () => {
    const B = [box(4, 4.5, 1), box(4.8, 6, 3)], w = world(B); run(w, B, { forward: 1 }, 240);
    expect(w.byId.p.transform.pos[0]).toBeLessThan(4);
    const T = [box(4, 4.5, 3)], t = world(T); run(t, T, { forward: 1 }, 200); run(t, T, { forward: 1, jump: 1 }, 2); run(t, T, { forward: 1 }, 120);
    expect(t.byId.p.transform.pos[0]).toBeLessThan(4);
  });
  it('the same twice', () => {
    const B = [box(4, 4.5, 1)], a = world(B), b = world(B); run(a, B, { forward: 1 }, 200); run(b, B, { forward: 1 }, 200);
    expect(a.byId.p.transform.pos).toEqual(b.byId.p.transform.pos);
  });
});

describe('a thing laid in courses', () => {
  // a wall as a level's blocks lay it: bricks half a metre high, a metre long, stacked
  const courses = (x0, x1, rows) => { const out = []; for (let r = 0; r < rows; r++) for (let y = -3; y < 3; y++) out.push({ min: [x0, y, r * 0.52], max: [x1, y + 1, (r + 1) * 0.52] }); return out; };
  it('is one thing: two courses are gone over out of the run, four are climbed onto on the jump', () => {
    const low = courses(4, 4.5, 2), a = world(low), top = run(a, low, { forward: 1 }, 240);
    expect(a.byId.p.transform.pos[0]).toBeGreaterThan(5);
    expect(top).toBeGreaterThan(1.04);
    const high = courses(4, 4.5, 4), b = world(high); run(b, high, { forward: 1 }, 240);
    expect(b.byId.p.transform.pos[0]).toBeLessThan(4);
    run(b, high, { forward: 1, jump: 1 }, 2); run(b, high, {}, 240);
    expect(b.byId.p.transform.pos[2]).toBeCloseTo(2.08, 1);
  });
});

describe('a climb is solved from the hands', () => {
  const B = [box(4, 8, 1.9)];
  it('the feet stay down while the hands reach, and the body never stands higher than the hands on the edge allow', () => {
    const w = world(B), H = hooks(B); run(w, B, { forward: 1 }, 240);
    const z = []; E.stepWorld(w, { forward: 1, jump: 1 }, 1 / 60, H);
    for (let k = 0; k < 200 && w.byId.p.fr; k++) { E.stepWorld(w, {}, 1 / 60, H); if (w.byId.p.fr) z.push([w.byId.p.fr.t, w.byId.p.transform.pos[2]]); }
    expect(z.length).toBeGreaterThan(30);
    expect(z.filter(([t]) => t < 0.2).every(([, h]) => h < 0.02)).toBe(true);        // the reach: on the ground
    expect(z.every(([, h], i) => i === 0 || h >= z[i - 1][1] - 1e-9)).toBe(true);     // it only rises
    expect(w.byId.p.transform.pos[2]).toBeCloseTo(1.9, 2);
  });
  it('an edge the hands cannot reach is not climbed, whatever `climb` says', () => {
    const tall = [box(4, 8, 2.4)], w = world(tall, { climb: 3 }); run(w, tall, { forward: 1 }, 240); run(w, tall, { forward: 1, jump: 1 }, 2); run(w, tall, {}, 200);
    expect(w.byId.p.transform.pos[2]).toBeLessThan(0.6);
    const ok = [box(4, 8, 2.1)], v = world(ok, { climb: 3 }); run(v, ok, { forward: 1 }, 240); run(v, ok, { forward: 1, jump: 1 }, 2); run(v, ok, {}, 240);
    expect(v.byId.p.transform.pos[2]).toBeCloseTo(2.1, 1);
  });
  it('a vault whose clip carries the body is lifted only by what the thing is taller than the clip\'s box', () => {
    const W = [box(4, 4.5, 1)], a = world(W), b = world(W, { clipH: 0.5 });
    const ta = run(a, W, { forward: 1 }, 240), tb = run(b, W, { forward: 1 }, 240);
    expect(ta).toBeGreaterThan(1.1);
    expect(tb).toBeLessThan(0.6);
    expect(tb).toBeGreaterThan(0.5);
    expect(b.byId.p.transform.pos[0]).toBeGreaterThan(5);
  });
});

describe('the push', () => {
  const B = [box(4, 8, 1.9)];
  const armed = (freeRun) => { const w = world(B, freeRun); w.byId.p.weapon = { ammo: 9 }; return w; };
  it('nothing pressed: the stick held into a wall it can climb climbs it, after the hold; let go before, it does not', () => {
    const a = world(B, { on: 'push' }); run(a, B, { forward: 1 }, 200);
    expect(a.byId.p.transform.pos[2]).toBeCloseTo(1.9, 1);
    const b = world(B, { on: 'push', hold: 5 }); run(b, B, { forward: 1 }, 240);
    expect(b.byId.p.transform.pos[2]).toBeLessThan(0.01);
    // (and the jump is no longer what climbs)
    const c = world(B, { on: 'push', hold: 5 }); run(c, B, { forward: 1 }, 100); run(c, B, { forward: 1, jump: 1 }, 2);
    expect(c.byId.p.fr == null).toBe(true);
  });
  it('what is in hand is put away through the climb, and in hand again on the top', () => {
    const w = armed({ on: 'push' }), H = hooks(B), G = w.byId.p.weapon; let away = 0, held = 0;
    for (let k = 0; k < 400; k++) { E.stepWorld(w, { forward: 1 }, 1 / 60, H); if (w.byId.p.fr && w.byId.p.fr.kind === 'climb') { if (w.byId.p.weapon == null) away++; else held++; } }
    expect(away).toBeGreaterThan(20);
    expect(held).toBe(0);
    expect(w.byId.p.weapon).toBe(G);
  });
});
