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
  it('a wall over the hip is not vaulted; the jump at it climbs over a thin one, and onto a deep one', () => {
    const thin = [box(4, 4.5, 1.9)];
    const a = world(thin); run(a, thin, { forward: 1 }, 240);
    expect(a.byId.p.transform.pos[0]).toBeLessThan(4);
    run(a, thin, { forward: 1, jump: 1 }, 2); run(a, thin, { forward: 1 }, 240);
    expect(a.byId.p.transform.pos[0]).toBeGreaterThan(5);
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
  it('is one thing: two courses are gone over out of the run, four are climbed on the jump', () => {
    const low = courses(4, 4.5, 2), a = world(low), top = run(a, low, { forward: 1 }, 240);
    expect(a.byId.p.transform.pos[0]).toBeGreaterThan(5);
    expect(top).toBeGreaterThan(1.04);
    const high = courses(4, 4.5, 4), b = world(high); run(b, high, { forward: 1 }, 240);
    expect(b.byId.p.transform.pos[0]).toBeLessThan(4);
    run(b, high, { forward: 1, jump: 1 }, 2); run(b, high, { forward: 1 }, 240);
    expect(b.byId.p.transform.pos[0]).toBeGreaterThan(5);
  });
});
